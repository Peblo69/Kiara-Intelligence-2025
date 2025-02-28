import { authenticator } from 'otplib';
import QRCode from 'qrcode';

// Configure authenticator
authenticator.options = {
  window: 1,        // Allow 1 step before/after for time drift
  step: 30,         // 30 second step
  digits: 6         // 6 digit codes
};

export async function generateTOTP() {
  // Generate random secret
  const secret = authenticator.generateSecret();

  // Generate QR code
  const otpauth = authenticator.keyuri(
    'user',
    'Kiara Intelligence',
    secret
  );

  const qrCode = await QRCode.toDataURL(otpauth);

  return { secret, qrCode };
}

export function verifyTOTP(secret: string, token: string): boolean {
  try {
    return authenticator.verify({ token, secret, window: 1 });
  } catch (error) {
    console.error('Error verifying TOTP:', error);
    return false;
  }
}