'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Card } from '@/components/ui/surface';
import { Field, Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SettingsHeader } from '@/components/app/settings-header';
import { useAuth } from '@/contexts/auth-context';
import { Mail, User as UserIcon } from '@/components/icons';

const profileSchema = z.object({
  name: z.string().min(2, 'Tell us your name.').max(60),
  email: z.string().email('That email looks off.'),
});
type ProfileValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { user } = useAuth();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', email: '' },
  });

  useEffect(() => {
    if (user) reset({ name: user.name, email: user.email });
  }, [user, reset]);

  async function onSubmit(values: ProfileValues) {
    // TODO(BE): PATCH /auth/me
    await new Promise((r) => setTimeout(r, 600));
    toast.success('Profile updated');
    reset(values);
  }

  return (
    <>
      <SettingsHeader
        title={
          <>
            Your{' '}
            <em className="text-accent" style={{ fontStyle: 'italic' }}>
              profile.
            </em>
          </>
        }
        lead="The basics. Visible only to you and admins of your workspace."
      />

      <Card className="mb-5">
        <div className="mb-5 flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#c4a07a] to-[#7a5b3a] font-mono text-lg font-medium text-paper">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h4 className="m-0 mb-1 text-[15px] font-medium text-paper">{user?.name}</h4>
            <p className="m-0 font-mono text-[11px] text-muted">{user?.email}</p>
          </div>
          <div className="ml-auto">
            <Button variant="secondary" size="sm">Upload photo</Button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="full name" htmlFor="name" error={errors.name?.message}>
            <Input
              id="name"
              iconLeft={<UserIcon size={16} />}
              invalid={!!errors.name}
              {...register('name')}
            />
          </Field>
          <Field label="email" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              iconLeft={<Mail size={16} />}
              invalid={!!errors.email}
              {...register('email')}
            />
          </Field>

          <div className="sm:col-span-2 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => user && reset({ name: user.name, email: user.email })}
              disabled={!isDirty}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting} disabled={!isDirty}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h4 className="m-0 mb-1 text-[15px] font-medium text-paper">Danger zone</h4>
        <p className="m-0 mb-5 text-[12.5px] text-muted">
          Permanently delete your account and all associated data. This cannot be undone.
        </p>
        <Button variant="danger" size="sm">Delete account</Button>
      </Card>
    </>
  );
}
