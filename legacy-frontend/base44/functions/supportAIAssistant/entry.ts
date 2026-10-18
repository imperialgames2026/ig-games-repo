import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const chatId = body.chatId;
    const latestUserMessage = String(body.message || '').trim();

    if (!chatId || !latestUserMessage) {
      return Response.json({ error: 'chatId and message are required' }, { status: 400 });
    }

    const chat = await base44.entities.SupportChat.get(chatId);
    if (!chat || chat.user_email !== user.email) {
      return Response.json({ error: 'Chat not found' }, { status: 404 });
    }

    const recentMessages = (chat.messages || []).slice(-8).map((msg) => {
      const speaker = msg.is_admin ? 'Support' : msg.sender_name || 'User';
      return `${speaker}: ${msg.message}`;
    }).join('\n');

    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are Imperial Gaming's AI support helper inside live support chat.

Your job is to reduce admin workload by solving common support issues directly in the chat.
You can help with:
- account questions
- game rules and how games work
- bonuses and VIP explanations
- Base44 Payments / crypto deposit and withdrawal guidance
- KYC process guidance
- general navigation and troubleshooting

Important rules:
- Be concise, helpful, and friendly.
- This is a social casino brand voice: premium, confident, clear.
- Never claim an admin already did something unless it actually happened.
- Never promise refunds, payouts, or account changes.
- If the issue needs a real admin, or needs KYC review/verification help beyond general guidance, mark it for human review.
- If the issue can be solved with guidance, solve it directly and do not escalate.
- End with a short next step.

Also classify the case:
- support_only = normal admin/support follow-up needed
- kyc_help = needs human KYC review/help
- none = no human admin needed

User: ${user.full_name || user.email}
Email: ${user.email}

Recent support chat:
${recentMessages}

Latest user message:
${latestUserMessage}`,
      response_json_schema: {
        type: 'object',
        properties: {
          reply: { type: 'string' },
          needs_admin: { type: 'boolean' },
          action_type: { type: 'string', enum: ['none', 'support_only', 'kyc_help'] },
          internal_note: { type: 'string' }
        },
        required: ['reply', 'needs_admin', 'action_type', 'internal_note']
      }
    });

    const replyText = aiResponse?.reply || 'I\'m here to help.';
    const needsAdmin = !!aiResponse?.needs_admin;
    const actionType = aiResponse?.action_type || 'none';
    const internalNote = aiResponse?.internal_note || '';
    const alreadyEscalated = (chat.messages || []).some((msg) => msg.sender_email === 'ai-escalation@imperialgaming.games');

    const aiMessage = {
      sender_email: 'ai-support@imperialgaming.games',
      sender_name: 'Imperialist AI',
      message: replyText,
      timestamp: new Date().toISOString(),
      is_admin: true,
    };

    const updatedMessages = [...(chat.messages || []), aiMessage];

    let finalMessages = updatedMessages;

    if (needsAdmin && !alreadyEscalated) {
      const escalationNote = {
        sender_email: 'ai-escalation@imperialgaming.games',
        sender_name: 'System Notice',
        message: 'AI requested human support for this conversation. Admin team has been notified.',
        timestamp: new Date().toISOString(),
        is_admin: true,
      };

      finalMessages = [...updatedMessages, escalationNote];

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: 'imperorimp@gmail.com',
        from_name: 'Imperial Gaming Support',
        subject: `Support escalation needed: ${chat.user_name || chat.user_email}`,
        body: `
          <h2>AI Escalated a Support Chat</h2>
          <p>The AI helper marked this conversation for human review.</p>
          <table style="border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 8px; font-weight: bold;">User:</td><td style="padding: 8px;">${chat.user_name || 'Unknown User'}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;">${chat.user_email}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Latest message:</td><td style="padding: 8px; background: #f9f9f9;">${latestUserMessage}</td></tr>
          </table>
          <br/>
          <p>Please review this conversation in the support dashboard.</p>
          <p><a href="https://imperialhouse.online/AdminSupport" style="background: #ec4899; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px;">Open Support Dashboard</a></p>
        `,
      });
    }

    await base44.entities.SupportChat.update(chatId, {
      messages: finalMessages,
      last_message_at: new Date().toISOString(),
      status: needsAdmin ? 'open' : (chat.status || 'open'),
      ai_needs_human_review: needsAdmin,
      ai_support_note: internalNote,
      ai_action_type: actionType,
    });

    return Response.json({ success: true, escalated: needsAdmin, reply: replyText, actionType, internalNote });
  } catch (error) {
    console.error('supportAIAssistant error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});