import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';

export default function Login() {
  const { register, handleSubmit } = useForm({ defaultValues: { email: 'alex@acme.com', password: 'Password123!' } });
  const login = useGameStore((s) => s.login);
  const loading = useGameStore((s) => s.loading);
  const error = useGameStore((s) => s.error);
  const navigate = useNavigate();

  const onSubmit = async ({ email, password }) => {
    if (await login(email, password)) navigate('/dashboard');
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
        <h1 className="text-3xl font-extrabold text-royal mt-1 mb-6">Sign in to play</h1>

        <label className="block text-sm mb-1 font-semibold text-slate-500">Email</label>
        <input {...register('email')} className="field mb-4" />

        <label className="block text-sm mb-1 font-semibold text-slate-500">Password</label>
        <input type="password" {...register('password')} className="field mb-6" />

        {error && <div className="text-red-500 text-sm mb-4">{error}</div>}

        <button disabled={loading} className="btn-primary w-full">
          {loading ? 'Starting engines…' : 'Start SDLC  Quest →'}
        </button>
        <p className="text-slate-500 text-sm mt-4 text-center">
          New here? <Link to="/signup" className="text-royal font-semibold">Create an account</Link>
        </p>
        <p className="text-slate-400 text-xs mt-2 text-center">Demo: alex@acme.com · Password123!</p>
      </motion.form>
    </div>
  );
}
