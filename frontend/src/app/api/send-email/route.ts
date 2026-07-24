import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      type, 
      name, 
      email, 
      company, 
      message, 
      analysis_id, 
      repo_name, 
      health_score,
      role,
      primary_goal,
      referral_source 
    } = body;

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
          <p><strong>Role in Company:</strong> ${role || "N/A"}</p>
          <p><strong>Goal / Use Case:</strong> ${primary_goal || "N/A"}</p>
          <p><strong>Referral Source:</strong> ${referral_source || "N/A"}</p>
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
            <tr><td style="padding: 6px 0; color: #837e80; width: 150px;">Founder Name:</td><td style="font-weight: bold;">${name || "Unknown"}</td></tr>
            <tr><td style="padding: 6px 0; color: #837e80;">Email:</td><td>${email || "Unknown"}</td></tr>
            <tr><td style="padding: 6px 0; color: #837e80;">Company:</td><td style="font-weight: bold;">${company || "Unknown"}</td></tr>
            <tr><td style="padding: 6px 0; color: #837e80;">Role in Company:</td><td>${role || "N/A"}</td></tr>
            <tr><td style="padding: 6px 0; color: #837e80;">Goal / Use Case:</td><td>${primary_goal || "N/A"}</td></tr>
            <tr><td style="padding: 6px 0; color: #837e80;">Referral Source:</td><td>${referral_source || "N/A"}</td></tr>
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

    const customerSubject = "We received your request — Trixon";
    const customerHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e0dada; border-radius: 12px;">
        <h2 style="color: #1e1b1b; border-bottom: 2px solid #039a85; padding-bottom: 8px;">Hi ${name || "there"},</h2>
        <p style="color: #555; font-size: 14px; leading-relaxed: 1.5;">
          Thanks for reaching out to Trixon! We have successfully received your details.
        </p>
        <p style="color: #555; font-size: 14px; leading-relaxed: 1.5;">
          Our team is already reviewing your submission. A technical advisor will personally get back to you within 24 hours.
        </p>
        ${type === "scoping_call" ? `
          <p style="color: #555; font-size: 14px; leading-relaxed: 1.5;">
            <strong>Next Step:</strong> If you haven't booked your calendar slot yet, please do so using our calendar scheduling page to secure your 30-minute scoping call.
          </p>
        ` : ""}
        <br/>
        <p style="color: #837e80; font-size: 12px; border-top: 1px solid #f0eded; padding-top: 15px; margin-top: 15px;">
          Best regards,<br/>
          <strong>Saqib</strong><br/>
          Founder, Trixon
        </p>
      </div>
    `;

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
        `-----------------------------------------\n` +
        `To (Customer Confirmation): ${email}\n` +
        `Subject (Customer Confirmation): ${customerSubject}\n` +
        `HTML (Customer Confirmation):\n${customerHtml}\n` +
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
        rejectUnauthorized: false
      }
    });

    console.info(`[SMTP DIAGNOSTIC] Sending lead alert to ${smtpTo} and confirmation to ${email}`);
    
    // Send to Trixon Team
    await transporter.sendMail({
      from: smtpFrom,
      to: smtpTo,
      subject: subject,
      html: html,
    });

    // Send confirmation to Customer (best-effort)
    try {
      await transporter.sendMail({
        from: smtpFrom,
        to: email,
        subject: customerSubject,
        html: customerHtml,
      });
      console.info(`[SMTP DIAGNOSTIC] Confirmation email successfully sent to customer: ${email}`);
    } catch (custErr) {
      console.error("[SMTP DIAGNOSTIC] Failed to send confirmation email to customer:", custErr);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Nodemailer error in /api/send-email:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to send email",
      code: error.code,
      command: error.command
    }, { status: 500 });
  }
}
