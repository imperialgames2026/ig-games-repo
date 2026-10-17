import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));

    // If called directly with user data (from KYC page submission), send immediate notification
    if (payload?.data?.kyc_status === 'submitted') {
      const data = payload.data;
      const userName = data.full_name || data.email || 'Unknown User';
      const userEmail = data.email || 'N/A';
      const submittedAt = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: 'imperial.games2026@gmail.com',
        from_name: 'Imperial Gaming - KYC Alert',
        subject: `⚠️ New KYC Submission Requires Review - ${userName}`,
        body: `
          <h2>New KYC Submission</h2>
          <p>A user has submitted their identity verification and requires your review.</p>
          <table style="border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 8px; font-weight: bold;">Name:</td><td style="padding: 8px;">${userName}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;">${userEmail}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Submitted:</td><td style="padding: 8px;">${submittedAt}</td></tr>
          </table>
          <br/>
          <p><strong>Action Required:</strong> Please log in to the Admin KYC dashboard to review and approve or reject this submission.</p>
          <p><a href="https://imperialhouse.online/AdminKYC" style="background: #ec4899; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px;">Review KYC Submission</a></p>
        `,
      });

      console.log(`Immediate KYC notification sent for: ${userEmail}`);
      return Response.json({ success: true, mode: 'immediate' });
    }

    // Scheduled mode: query all submitted KYC users and send a digest if any pending
    const allUsers = await base44.asServiceRole.entities.User.filter({ kyc_status: 'submitted' }).catch(() => []);

    if (!allUsers || allUsers.length === 0) {
      console.log('No pending KYC submissions found.');
      return Response.json({ success: true, pending: 0 });
    }

    const userRows = allUsers.map(u =>
      `<tr><td style="padding:8px;">${u.full_name || 'N/A'}</td><td style="padding:8px;">${u.email}</td><td style="padding:8px;">${u.kyc_submitted_at ? new Date(u.kyc_submitted_at).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'Unknown'}</td></tr>`
    ).join('');

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: 'imperial.games2026@gmail.com',
      from_name: 'Imperial Gaming - KYC Reminder',
      subject: `⚠️ ${allUsers.length} Pending KYC Submission(s) Awaiting Review`,
      body: `
        <h2>Pending KYC Submissions</h2>
        <p>There are <strong>${allUsers.length}</strong> user(s) waiting for KYC review.</p>
        <table style="border-collapse: collapse; width: 100%; border: 1px solid #ddd;">
          <thead>
            <tr style="background: #f2f2f2;">
              <th style="padding:8px; text-align:left;">Name</th>
              <th style="padding:8px; text-align:left;">Email</th>
              <th style="padding:8px; text-align:left;">Submitted</th>
            </tr>
          </thead>
          <tbody>${userRows}</tbody>
        </table>
        <br/>
        <p><a href="https://imperialhouse.online/AdminKYC" style="background: #ec4899; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px;">Review KYC Submissions</a></p>
      `,
    });

    console.log(`KYC digest sent: ${allUsers.length} pending submissions`);
    return Response.json({ success: true, pending: allUsers.length });
  } catch (error) {
    console.error('KYC notification error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});