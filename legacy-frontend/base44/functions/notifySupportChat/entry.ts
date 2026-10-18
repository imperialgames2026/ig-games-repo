import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { data, old_data, event } = payload;

    // Only notify on newly created chats (first message from user)
    if (event?.type !== 'create') {
      return Response.json({ skipped: true });
    }

    const userName = data.user_name || data.user_email || 'Unknown User';
    const userEmail = data.user_email || 'N/A';
    const firstMessage = data.messages?.[0]?.message || 'No message';
    const createdAt = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

    const emailBody = `
      <h2>New Support Chat Started</h2>
      <p>A user has opened a support ticket that needs attention.</p>
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 8px; font-weight: bold;">User:</td><td style="padding: 8px;">${userName}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;">${userEmail}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Time:</td><td style="padding: 8px;">${createdAt}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Message:</td><td style="padding: 8px; background: #f9f9f9;">${firstMessage}</td></tr>
      </table>
      <br/>
      <p>Please respond via the support dashboard or reply to the user directly at <a href="mailto:${userEmail}">${userEmail}</a>.</p>
      <p><a href="https://imperialhouse.online/AdminSupport" style="background: #ec4899; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px;">Go to Support Dashboard</a></p>
    `;

    // Send to hardcoded admin notification email
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: 'imperorimp@gmail.com',
      from_name: 'Imperial Gaming - Support Alert',
      subject: `💬 New Support Request from ${userName}`,
      body: emailBody,
    });

    console.log(`Support notification sent for user: ${userEmail}`);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Support notification error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});