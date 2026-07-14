import { forwardRef, useState } from 'react';

const EyeIcon = ({ off }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <line x1="4" y1="4" x2="20" y2="20" />}
  </svg>
);

// Password field with an eye toggle. forwardRef so react-hook-form's
// register() spread works exactly like on a plain <input>. Put margin
// utilities on wrapperClassName so the toggle stays vertically centred.
const PasswordInput = forwardRef(function PasswordInput({ className = '', wrapperClassName = '', ...props }, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className={`relative ${wrapperClassName}`}>
      <input ref={ref} type={show ? 'text' : 'password'} {...props} className={`${className} w-full pr-11`} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
      >
        <EyeIcon off={show} />
      </button>
    </div>
  );
});

export default PasswordInput;
