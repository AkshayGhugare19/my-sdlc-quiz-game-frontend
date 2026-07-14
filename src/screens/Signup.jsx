import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import { useGameStore } from '../store/gameStore';
import PasswordInput from '../components/PasswordInput';

// New-learner signup. The player picks their organization and a role —
// EMPLOYEE (full experience) or GUEST (demo mode). Learner roles are enforced
// server-side and the account gets a default avatar automatically.
export default function Signup() {
  const { register, handleSubmit, watch } = useForm({ defaultValues: { role: 'EMPLOYEE' } });
  const signup = useGameStore((s) => s.signup);
  const loading = useGameStore((s) => s.loading);
  const error = useGameStore((s) => s.error);
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);

  useEffect(() => {
    api.organizations().then(setOrgs).catch(() => setOrgs([]));
  }, []);

  const onSubmit = async (values) => {
    const ok = await signup({
      email: values.email,
      password: values.password,
      firstName: values.firstName,
      lastName: values.lastName,
      organizationSlug: values.organizationSlug,
      role: values.role || 'EMPLOYEE',
    });
    if (ok) navigate('/login');
  };

  return (
    <div className="min-h-full grid place-items-center p-6">
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit(onSubmit)}
        className="panel rounded-3xl p-8 w-full max-w-md"
      >
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🏎️</span>
          <span className="text-royal text-sm font-extrabold tracking-widest">SDLC QUEST</span>
        </div>
        <h1 className="text-3xl font-extrabold text-royal mt-1 mb-6">Create your account</h1>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <input {...register('firstName')} placeholder="First name" className="field" />
          <input {...register('lastName')} placeholder="Last name" className="field" />
        </div>

        <label className="block text-sm mb-1 font-semibold text-slate-500">Organization</label>
        <select {...register('organizationSlug', { required: true })} className="field mb-4">
          <option value="">Select your organization…</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.slug}>{o.name}</option>
          ))}
        </select>

        <label className="block text-sm mb-1 font-semibold text-slate-500">Role</label>
        <select {...register('role')} className={`field ${watch('role') === 'GUEST' ? 'mb-2' : 'mb-4'}`}>
          <option value="EMPLOYEE">Employee — full experience (XP, stars, rewards, tournaments)</option>
          <option value="GUEST">Guest — demo mode (play everything, no real points or rewards)</option>
        </select>
        {watch('role') === 'GUEST' && (
          <p className="text-xs text-slate-500 mb-4">
            Demo accounts can explore every mission, but XP, stars, coins, badges and accessories are not credited.
          </p>
        )}

        <label className="block text-sm mb-1 font-semibold text-slate-500">Email</label>
        <input type="email" {...register('email', { required: true })} className="field mb-4" />

        <label className="block text-sm mb-1 font-semibold text-slate-500">Password</label>
        <PasswordInput {...register('password', { required: true, minLength: 6 })} className="field" wrapperClassName="mb-6" />

        {error && <div className="text-red-500 text-sm mb-4">{error}</div>}

        <button disabled={loading} className="btn-primary w-full">
          {loading ? 'Creating…' : 'Sign up & Play →'}
        </button>
        <p className="text-slate-500 text-sm mt-4 text-center">
          Already have an account? <Link to="/login" className="text-royal font-semibold">Log in</Link>
        </p>
      </motion.form>
    </div>
  );
}
