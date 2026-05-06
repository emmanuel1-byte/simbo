import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .regex(/[A-Z]/, 'Include at least one uppercase letter.')
  .regex(/[a-z]/, 'Include at least one lowercase letter.')
  .regex(/[0-9]/, 'Include at least one number.');

export const signupSchema = z.object({
  name: z.string().min(2, 'Tell us your name.').max(60),
  email: z.string().email('That email looks off.'),
  password: passwordSchema,
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms to continue.' }),
  }),
});
export type SignupValues = z.infer<typeof signupSchema>;

export const signinSchema = z.object({
  email: z.string().email('That email looks off.'),
  password: z.string().min(1, 'Enter your password.'),
});
export type SigninValues = z.infer<typeof signinSchema>;

export const forgotSchema = z.object({
  email: z.string().email('That email looks off.'),
});
export type ForgotValues = z.infer<typeof forgotSchema>;

export const resetSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits.'),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ['confirm'],
    message: 'Passwords don\u2019t match.',
  });
export type ResetValues = z.infer<typeof resetSchema>;

export const otpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits.'),
});
export type OtpValues = z.infer<typeof otpSchema>;
