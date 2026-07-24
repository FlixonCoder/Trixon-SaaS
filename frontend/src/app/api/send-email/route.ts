import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, name, email, company, message, analysis_id, repo_name, health_score } = body;

    const smtpHost = process.env.SMTP_HOST || "";
    const smtpPort = parseInt(process.env.SMTP_PORT || "587");
    const smtpUser = process.env.SMTP_USER || "";
    const smtpPass = process.env.SMTP_PASS || "";
    const smtpTo = process.env.SMTP_TO || "hello@trixon.cloud";
    const smtpFrom = process.env.SMTP_FROM || `"Trixon Alerts" <noreply@trixon.cloud>`;

    let subject = "";
    let html = "";

    if (type === "scoping_call") {
      subject = `[Trixon Scoping] Booking/Call request from ${name} (${company || "N/A"})`;
      html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0dada; border-radius: 12px;">
          <h2 style="color: #1e1b1b; border-bottom: 2px solid #039a85; padding-bottom: 8px;">📞 New Scoping Call Request</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Company:</strong> ${company || "N/A"}</p>
          <p><strong>Message / Context:</strong></p>
          <blockquote style="border-left: 3px solid #039a85; padding: 12px; background: #f9f9f8; color: #555; margin: 10px 0;">
            ${message ? message.replace(/\n/g, "<br/>") : "No message provided."}
          </blockquote>
        </div>
      `;
    } else if (type === "trixon_share") {
      subject = `[Trixon Audit] New founder share — ${company || "Unknown"}`;
      html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0dada; border-radius: 12px;">
          <h2 style="color: #1e1b1b; border-bottom: 2px solid #039a85; padding-bottom: 8px;">🔥 New Founder Share — Priority Inbound</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
            <tr><td style="padding: 6px 0; color: #837e80; width: 120px;">Founder Name:</td><td style="font-weight: bold;">${name || "Unknown"}</td></tr>
            <tr><td style="padding: 6px 0; color: #837e80;">Email:</td><td>${email || "Unknown"}</td></tr>
            <tr><td style="padding: 6px 0; color: #837e80;">Company:</td><td style="font-weight: bold;">${company || "Unknown"}</td></tr>
            <tr><td style="padding: 6px 0; color: #837e80;">Repository:</td><td>${repo_name || "Unknown"}</td></tr>
            <tr><td style="padding: 6px 0; color: #837e80;">Analysis ID:</td><td><code>${analysis_id || "Unknown"}</code></td></tr>
            <tr><td style="padding: 6px 0; color: #837e80;">Health Score:</td><td><strong style="color: #039a85; font-size: 16px;">${health_score ?? "N/A"}/100</strong></td></tr>
          </table>
          <p><strong>Founder Message:</strong></p>
          <blockquote style="border-left: 3px solid #039a85; padding: 12px; background: #f9f9f8; color: #555; margin: 10px 0;">
            ${message ? message.replace(/\n/g, "<br/>") : "No message provided."}
          </blockquote>
          <hr style="border: none; border-top: 1px solid #e0dada; margin: 20px 0;"/>
          <p style="color: #837e80; font-size: 12px;">This founder has shared their audit details with the Trixon team. Respond within 24 hours.</p>
        </div>
      `;
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    // Fallback: If SMTP credentials aren't set, log the email to console and return success
    if (!smtpHost || !smtpUser || !smtpPass) {
      console.info(
        `[SMTP WARNING] SMTP_HOST, SMTP_USER, or SMTP_PASS not set in environment.\n` +
        `Logging email output to console:\n` +
        `-----------------------------------------\n` +
        `To: ${smtpTo}\n` +
        `From: ${smtpFrom}\n` +
        `Subject: ${subject}\n` +
        `HTML:\n${html}\n` +
        `-----------------------------------------`
      );
      return NextResponse.json({ success: true, logged: true });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        // Do not fail on self-signed certificates (highly common on local relays/custom SMTP)
        rejectUnauthorized: false
      }
    });

    console.info(`[SMTP DIAGNOSTIC] Attempting to send email via ${smtpHost}:${smtpPort} (Secure: ${smtpPort === 465})`);
    
    await transporter.sendMail({
      from: smtpFrom,
      to: smtpTo,
      subject: subject,
      html: html,
    });

    console.info(`[SMTP DIAGNOSTIC] Email sent successfully to ${smtpTo}`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Nodemailer error in /api/send-email:", error);
    // Return detailed SMTP context in response to help the user diagnose the credentials issue
    return NextResponse.json({ 
      error: error.message || "Failed to send email",
      code: error.code,
      command: error.command
    }, { status: 500 });
  }
}
