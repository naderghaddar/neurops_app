type VerifyPasswordParams = {
  candidatePassword: string;
  storedPassword: string | null;
};

export async function verifyPassword(params: VerifyPasswordParams): Promise<boolean> {
  const { candidatePassword, storedPassword } = params;

  if (!storedPassword) {
    return false;
  }

  // Keep this async signature so bcrypt/argon2 can be added later with no call-site changes.
  return storedPassword === candidatePassword;
}
