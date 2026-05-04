import { createTransport, type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";

// Interfaces
interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface Order {
  _id: string;
  status: string;
  items: OrderItem[];
  total: number;
  shippingAddress?: ShippingAddress;
}

interface EmailContent {
  subject: string;
  message: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  message?: string;
}

interface OrderConfirmationParams {
  userEmail: string;
  userName: string;
  order: Order;
}

interface InvoiceEmailParams {
  to: string;
  subject: string;
  message: string;
  invoiceHtml: string;
  invoiceNumber: string;
}

interface GeneralEmailParams {
  to: string;
  subject: string;
  message: string;
  html?: string;
}

// Create transporter for sending emails with App Password
const createTransporter = (): Transporter<SMTPTransport.SentMessageInfo> => {
  return createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER || process.env.SENDER_EMAIL_ADDRESS,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Format currency helper
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

// Generate beautiful HTML email template
const generateOrderEmailHTML = (userName: string, order: Order): string => {
  const isDelivered = order.status === "delivered";
  const emailTitle = isDelivered ? "Order Delivered" : "Order Confirmation";
  const emailMessage =
    order.status === "delivered"
      ? `Great news! Your order #${order._id} has been delivered.`
      : `Thank you for your order! Your order #${order._id} has been confirmed.`;

  const subtotal = order.items.reduce((acc, item) => {
    return acc + item.price * item.quantity;
  }, 0);

  const freeDeliveryThreshold = parseFloat(
    process.env.FREE_DELIVERY_THRESHOLD || "999",
  );
  const shipping = subtotal > freeDeliveryThreshold ? 0 : 15;
  const taxRate = parseFloat(process.env.TAX_RATE || "0");
  const tax = subtotal * taxRate;

  const itemsHTML = order.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 15px; border-bottom: 1px solid #f0f0f0;">
        <div style="font-weight: 600; color: #1a1a1a; margin-bottom: 4px;">${item.name}</div>
        <div style="font-size: 14px; color: #666;">Quantity: ${item.quantity}</div>
      </td>
      <td style="padding: 15px; border-bottom: 1px solid #f0f0f0; text-align: right; font-weight: 600; color: #2563eb;">
        ${formatCurrency(item.price * item.quantity)}
      </td>
    </tr>
  `,
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation - Entry Ecommerce</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa; line-height: 1.6;">
  
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f7fa; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);">
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center;">
              <div style="background-color: white; display: inline-block; padding: 15px 25px; border-radius: 8px; margin-bottom: 20px;">
                <h1 style="margin: 0; color: #2563eb; font-size: 28px; font-weight: 700;">Entry Ecommerce</h1>
              </div>
              <h2 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">${emailTitle} ${order.status === "delivered" ? "🚚" : "🎉"}</h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 30px 20px 30px;">
              <h3 style="margin: 0 0 15px 0; color: #1a1a1a; font-size: 20px; font-weight: 600;">Hi ${userName}! 👋</h3>
              <p style="margin: 0; color: #666; font-size: 15px; line-height: 1.6;">${emailMessage}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                ${itemsHTML}
                <tr>
                  <td style="padding: 15px; background-color: #f8fafc; font-weight: 600; color: #666;">Subtotal</td>
                  <td style="padding: 15px; background-color: #f8fafc; text-align: right; font-weight: 600; color: #666;">${formatCurrency(subtotal)}</td>
                </tr>
                <tr>
                  <td style="padding: 15px; background-color: #f8fafc; font-weight: 600; color: #666;">Shipping</td>
                  <td style="padding: 15px; background-color: #f8fafc; text-align: right; font-weight: 600; color: #666;">${formatCurrency(shipping)}</td>
                </tr>
                <tr>
                  <td style="padding: 15px; background-color: #f8fafc; font-weight: 600; color: #666;">Tax</td>
                  <td style="padding: 15px; background-color: #f8fafc; text-align: right; font-weight: 600; color: #666;">${formatCurrency(tax)}</td>
                </tr>
                <tr style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);">
                  <td style="padding: 20px; color: #ffffff; font-weight: 700; font-size: 16px;">TOTAL</td>
                  <td style="padding: 20px; text-align: right; color: #ffffff; font-weight: 700; font-size: 20px;">${formatCurrency(order.total)}</td>
                </tr>
              </table>
            </td>
          </tr>
          ${
            order.shippingAddress
              ? `
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h4 style="margin: 0 0 15px 0; color: #1a1a1a; font-size: 16px; font-weight: 600;">📦 Shipping Address</h4>
              <div style="background-color: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
                <p style="margin: 0; color: #1a1a1a; line-height: 1.6; font-size: 15px;">
                  ${order.shippingAddress.street}<br>
                  ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}<br>
                  ${order.shippingAddress.country}
                </p>
              </div>
            </td>
          </tr>`
              : ""
          }
          <tr>
            <td style="background-color: #1f2937; padding: 30px; text-align: center;">
              <p style="margin: 0 0 15px 0; color: #ffffff; font-size: 16px; font-weight: 600;">Thank you for choosing Entry Ecommerce!</p>
              <p style="margin: 0; color: #6b7280; font-size: 12px;">© 2025 Entry Ecommerce. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

// Generate plain text version for email clients that don't support HTML
const generateOrderEmailContent = (
  userName: string,
  order: Order,
): EmailContent => {
  const isDelivered = order.status === "delivered";
  const emailTitle = isDelivered ? "Order Delivered" : "Order Confirmation";
  const emailMessage = isDelivered
    ? `Great news! Your order #${order._id} has been delivered!`
    : `Thank you for your order! Your order #${order._id} has been confirmed.`;

  const subtotal = order.items.reduce((acc, item) => {
    return acc + item.price * item.quantity;
  }, 0);

  const freeDeliveryThreshold = parseFloat(
    process.env.FREE_DELIVERY_THRESHOLD || "999",
  );
  const shipping = subtotal > freeDeliveryThreshold ? 0 : 15;
  const taxRate = parseFloat(process.env.TAX_RATE || "0");
  const tax = subtotal * taxRate;

  const itemsList = order.items
    .map(
      (item) =>
        `• ${item.name} (Qty: ${item.quantity}) - ${formatCurrency(item.price * item.quantity)}`,
    )
    .join("\n");

  return {
    subject: `${emailTitle} #${order._id} - Entry Ecommerce`,
    message: `
Hi ${userName},

${emailMessage}

Order Details:
- Order Number: #${order._id}
- Status: ${order.status}

Items Ordered:
${itemsList}

Order Summary:
- Subtotal: ${formatCurrency(subtotal)}
- Shipping: ${shipping === 0 ? "Free" : formatCurrency(shipping)}
- Tax: ${formatCurrency(tax)}
- Total: ${formatCurrency(order.total)}

${
  order.shippingAddress
    ? `
Shipping Address:
${order.shippingAddress.street}
${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}
${order.shippingAddress.country}
`
    : ""
}

Need Help?
Email: support@entry.reactbd.com
Phone: +1 (555) 123-4567

Thanks for choosing Entry Ecommerce!
    `,
  };
};

// Send order confirmation email
const sendOrderConfirmationEmail = async ({
  userEmail,
  userName,
  order,
}: OrderConfirmationParams): Promise<EmailResult> => {
  try {
    const emailContent = generateOrderEmailContent(userName, order);
    const htmlContent = generateOrderEmailHTML(userName, order);

    const transporter = createTransporter();

    const mailOptions = {
      from: `"Entry Ecommerce" <${process.env.SENDER_EMAIL_ADDRESS || "noor.jsdivs@gmail.com"}>`,
      to: userEmail,
      subject: emailContent.subject,
      text: emailContent.message,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    const err = error as Error;
    console.error("❌ Failed to send order confirmation:", err.message);
    return {
      success: false,
      error: err.message,
      message: "Email service unavailable - order created successfully",
    };
  }
};

// Send invoice email
const sendInvoiceEmail = async ({
  to,
  subject,
  message,
  invoiceHtml,
}: InvoiceEmailParams): Promise<EmailResult> => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Entry Ecommerce" <${process.env.SENDER_EMAIL_ADDRESS || "reactjsbd@gmail.com"}>`,
      to,
      subject,
      text: message,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #1e40af; margin: 0;">Entry Ecommerce - Invoice</h2>
          </div>
          <div style="background-color: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px;">
            <p style="color: #374151; line-height: 1.6; margin-bottom: 16px;">
              ${message.replace(/\n/g, "<br>")}
            </p>
          </div>
          <div style="background-color: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            ${invoiceHtml}
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email");
  }
};

// Send general email
const sendEmail = async ({
  to,
  subject,
  message,
  html,
}: GeneralEmailParams): Promise<EmailResult> => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Entry Ecommerce" <${process.env.SENDER_EMAIL_ADDRESS || "reactjsbd@gmail.com"}>`,
      to,
      subject,
      text: message,
      html:
        html ||
        `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #1e40af; margin: 0;">Entry Ecommerce</h2>
          </div>
          <div style="background-color: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <p style="color: #374151; line-height: 1.6;">
              ${message.replace(/\n/g, "<br>")}
            </p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email");
  }
};

// Send password reset email
const sendPasswordResetEmail = async (
  email: string,
  userName: string,
  resetUrl: string,
): Promise<EmailResult> => {
  const transporter = createTransporter();

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - Entry Ecommerce</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa; line-height: 1.6;">
  
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f7fa; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);">
          <tr>
            <td style="background: linear-gradient(135deg, #29beb3 0%, #a96bde 100%); padding: 40px 30px; text-align: center;">
              <div style="background-color: white; display: inline-block; padding: 15px 25px; border-radius: 8px; margin-bottom: 20px;">
                <h1 style="margin: 0; color: #29beb3; font-size: 28px; font-weight: 700;">Entry Ecommerce</h1>
              </div>
              <h2 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">🔐 Reset Your Password</h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h3 style="margin: 0 0 15px 0; color: #1a1a1a; font-size: 20px; font-weight: 600;">Hi ${userName}! 👋</h3>
              <p style="margin: 0 0 20px 0; color: #666; font-size: 15px; line-height: 1.6;">
                We received a request to reset your password for your Entry Ecommerce account.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #29beb3 0%, #a96bde 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Reset My Password
                    </a>
                  </td>
                </tr>
              </table>
              <div style="background-color: #fff8e1; border-left: 4px solid #ffc107; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.5;">
                  <strong>⚠️ Important:</strong> This link will expire in 1 hour.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="margin: 0; color: #999; font-size: 12px;">
                © ${new Date().getFullYear()} Entry Ecommerce. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const mailOptions = {
    from: `"Entry Ecommerce" <${process.env.SENDER_EMAIL_ADDRESS}>`,
    to: email,
    subject: "Reset Your Password - Entry Ecommerce",
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Password reset email sent:", info.messageId);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw new Error("Failed to send password reset email");
  }
};

// Send verification email
const sendVerificationEmail = async (
  email: string,
  userName: string,
  verifyUrl: string,
): Promise<EmailResult> => {
  const transporter = createTransporter();

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - Entry Ecommerce</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa; line-height: 1.6;">
  
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f7fa; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);">
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center;">
              <div style="background-color: white; display: inline-block; padding: 15px 25px; border-radius: 8px; margin-bottom: 20px;">
                <h1 style="margin: 0; color: #2563eb; font-size: 28px; font-weight: 700;">Entry Ecommerce</h1>
              </div>
              <h2 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">✉️ Verify Your Email</h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h3 style="margin: 0 0 15px 0; color: #1a1a1a; font-size: 20px; font-weight: 600;">Hi ${userName}! 👋</h3>
              <p style="margin: 0 0 20px 0; color: #666; font-size: 15px; line-height: 1.6;">
                Thanks for joining Entry Ecommerce! Please verify your email address to unlock full access to your account.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                <tr>
                  <td align="center">
                    <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>
              <div style="background-color: #ebb3051a; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                <p style="margin: 0; color: #b45309; font-size: 14px; line-height: 1.5;">
                  <strong>Note:</strong> This link will expire in 24 hours.
                </p>
              </div>
              <p style="margin: 0; color: #666; font-size: 14px;">
                If you didn't create an account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="margin: 0; color: #999; font-size: 12px;">
                © ${new Date().getFullYear()} Entry Ecommerce. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const mailOptions = {
    from: `"Entry Ecommerce" <${process.env.SENDER_EMAIL_ADDRESS || "reactjsbd@gmail.com"}>`,
    to: email,
    subject: "Verify Your Email - Entry Ecommerce",
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Verification email sent:", info.messageId);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new Error("Failed to send verification email");
  }
};

export {
  sendInvoiceEmail,
  sendEmail,
  sendOrderConfirmationEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
};
