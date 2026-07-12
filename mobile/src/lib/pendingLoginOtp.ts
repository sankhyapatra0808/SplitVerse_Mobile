export type PendingLoginOtp = {
  email: string;
  password: string;
  remember: boolean;
  sessionId: string;
  destinationEmail: string;
};

let pendingLoginOtp: PendingLoginOtp | null = null;

export function setPendingLoginOtp(value: PendingLoginOtp) {
  pendingLoginOtp = value;
}

export function getPendingLoginOtp() {
  return pendingLoginOtp;
}

export function clearPendingLoginOtp() {
  pendingLoginOtp = null;
}
