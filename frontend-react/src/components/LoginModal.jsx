import React, { useState, useRef, useEffect, useCallback } from 'react';
import API from '../utils/api';
import { useSettings } from '../contexts/SettingsContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com';

const LoginModal = ({ show, onClose }) => {
  const { settings } = useSettings();
  const isMaintenance = settings?.maintenance_mode === 'true' || settings?.maintenance_mode === true;

  // Auth mode: 'login' | 'signup' | 'forgot' | 'reset' | 'face'
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');

  // Login form
  const [email, setEmail] = useState('gaurav@lifeos.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');

  // Forgot/Reset
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const resetEmailRef = useRef('');

  // Email Verification
  const [verificationCode, setVerificationCode] = useState('');
  const verifyEmailRef = useRef('');

  // Face login
  const [faceEmail, setFaceEmail] = useState('');
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  const [faceLoading, setFaceLoading] = useState(true);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Google Sign-In
  const googleBtnRef = useRef(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (show) {
      setMode('login');
      setError('');
      setLoading(false);
    } else {
      stopFaceVideo();
    }
  }, [show]);

  // Initialize Google Sign-In button when in login/signup mode
  useEffect(() => {
    if (!show) return;
    if (mode !== 'login' && mode !== 'signup') return;

    const initGoogle = () => {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
          context: 'signin',
          ux_mode: 'popup',
          auto_prompt: false,
        });
        // Clear previous button render
        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type: 'standard',
          shape: 'rectangular',
          theme: 'outline',
          text: 'signin_with',
          size: 'large',
          logo_alignment: 'left',
          width: 300,
        });
      }
    };

    // Try immediately, retry after a short delay if GIS not loaded yet
    initGoogle();
    const timer = setTimeout(initGoogle, 500);
    return () => clearTimeout(timer);
  }, [show, mode]);

  // ─── Auth Handlers ───────────────────────────────

  const handleLogin = async (e) => {
    e.preventDefault();

    // Admin Override
    if (email === 'admin' && password === 'admin') {
      localStorage.setItem('admin_logged_in', 'true');
      window.location.href = '/admin';
      return;
    }

    if (isMaintenance) {
      setError('App is currently in maintenance mode. Only admins can login via /admin-login.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const response = await API.request('/auth/login', {
        method: 'POST',
        body: { email: email.trim(), password: password.trim() },
      });
      if (response.data?.requires_verification || response.requires_verification) {
        verifyEmailRef.current = email;
        setMode('verify');
      } else if (response.data?.requires_2fa || response.requires_2fa) {
        setTempToken(response.data?.temp_token || response.temp_token);
        setRequires2FA(true);
        setMode('2fa');
      } else {
        API.setAuthenticated(true);
        const profile = await API.saveCurrentAccount(response.data?.refresh_token);
        if (profile?.role === 'admin') {
          localStorage.setItem('admin_logged_in', 'true');
          window.location.href = '/admin';
        } else {
          window.location.href = '/app';
        }
      }
    } catch (err) {
      setError(err.message === 'Failed to fetch'
        ? 'Cannot connect to the backend server. Is it running?'
        : err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await API.request('/auth/login/2fa', {
        method: 'POST',
        body: { temp_token: tempToken, code: twoFactorCode },
      });
      API.setAuthenticated(true);
      await API.saveCurrentAccount(response.data?.refresh_token);
      window.location.href = '/app';
    } catch (err) {
      setError(err.message || 'Invalid 2FA code.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await API.request('/auth/register', {
        method: 'POST',
        body: { email, password, name },
      });
      if (response.data?.requires_verification || response.requires_verification) {
        verifyEmailRef.current = email;
        setMode('verify');
      } else {
        API.setAuthenticated(true);
        await API.saveCurrentAccount(response.data?.refresh_token);
        window.location.href = '/app';
      }
    } catch (err) {
      setError(err.message === 'Failed to fetch'
        ? 'Cannot connect to the backend server. Is it running?'
        : err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await API.request('/auth/verify-email', {
        method: 'POST',
        body: { email: verifyEmailRef.current, code: verificationCode },
      });
      API.setAuthenticated(true);
      await API.saveCurrentAccount(response.data?.refresh_token);
      window.location.href = '/app';
    } catch (err) {
      setError(err.message || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setError('');
    setLoading(true);
    try {
      await API.request('/auth/resend-verification', {
        method: 'POST',
        body: { email: verifyEmailRef.current },
      });
      alert('A new verification code has been sent to your email.');
    } catch (err) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await API.request('/auth/forgot-password', {
        method: 'POST',
        body: { email: forgotEmail },
      });
      resetEmailRef.current = forgotEmail;
      setMode('reset');
    } catch (err) {
      setError(err.message || 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await API.request('/auth/reset-password', {
        method: 'POST',
        body: {
          email: resetEmailRef.current,
          code: resetCode,
          new_password: newPassword,
        },
      });
      alert('Password successfully reset! You can now log in.');
      setMode('login');
      setResetCode('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Invalid code or something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Google Auth ─────────────────────────────────

  const handleGoogleResponse = async (response) => {
    if (isMaintenance) {
      setError('App is currently in maintenance mode.');
      return;
    }

    setLoading(true);
    try {
      const res = await API.request('/auth/google', {
        method: 'POST',
        body: { credential: response.credential },
      });
      
      if (res.data?.requires_2fa || res.requires_2fa) {
        setTempToken(res.data?.temp_token || res.temp_token);
        setRequires2FA(true);
        setMode('2fa');
      } else {
        API.setAuthenticated(true);
        const profile = await API.saveCurrentAccount(res.data?.refresh_token);
        if (profile?.role === 'admin') {
          localStorage.setItem('admin_logged_in', 'true');
          window.location.href = '/admin';
        } else {
          window.location.href = '/app';
        }
      }
    } catch (err) {
      setError(err.message === 'Failed to fetch'
        ? 'Cannot connect to the backend server. Is it running?'
        : err.message || 'Google Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  // Make handler available globally for GIS callback
  useEffect(() => {
    window.__handleGoogleCredential = handleGoogleResponse;
    return () => { delete window.__handleGoogleCredential; };
  }, [handleGoogleResponse]);

  // ─── Face Login ──────────────────────────────────

  const loadFaceModels = async () => {
    if (faceModelsLoaded) return;
    try {
      const faceapi = window.faceapi;
      if (!faceapi) {
        setFaceLoading(true);
        return;
      }
      await faceapi.nets.tinyFaceDetector.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models');
      setFaceModelsLoaded(true);
      setFaceLoading(false);
    } catch (e) {
      setFaceLoading(false);
      setError('Failed to load AI face models.');
    }
  };

  const startFaceVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      setError('Camera access denied.');
    }
  };

  const stopFaceVideo = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const switchToFace = () => {
    setError('');
    setMode('face');
    loadFaceModels();
    startFaceVideo();
  };

  const switchFromFace = () => {
    stopFaceVideo();
    setError('');
    setMode('login');
  };

  const handleFaceLogin = async (e) => {
    e.preventDefault();
    const faceapi = window.faceapi;
    if (!faceapi || !faceModelsLoaded) {
      setError('Please wait for AI models to load.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (!detection) {
        throw new Error('No face detected. Please look straight at the camera.');
      }
      const descriptor = Array.from(detection.descriptor);
      const res = await API.request('/auth/face-login', {
        method: 'POST',
        body: { email: faceEmail, descriptor },
      });
      API.setAuthenticated(true);
      await API.saveCurrentAccount(res.data?.refresh_token);
      window.location.href = '/app';
    } catch (err) {
      setError(err.message || 'Face login failed.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Mode Switching Helpers ──────────────────────

  const switchToSignUp = (e) => {
    e.preventDefault();
    setError('');
    if (email === 'gaurav@lifeos.com') {
      setEmail('');
      setPassword('');
    }
    setMode('signup');
  };

  const switchToLogin = (e) => {
    e.preventDefault();
    setError('');
    setMode('login');
  };

  const switchToForgot = (e) => {
    e.preventDefault();
    setError('');
    if (email && email !== 'gaurav@lifeos.com') {
      setForgotEmail(email);
    }
    setMode('forgot');
  };

  // ─── Titles / Subtitles ─────────────────────────

  const titles = {
    login: { title: 'Welcome Back', subtitle: 'Sign in to your LifeOS health portal' },
    signup: { title: 'Create Account', subtitle: 'Join LifeOS to optimize your health' },
    verify: { title: 'Verify Email', subtitle: `We sent a code to ${verifyEmailRef.current}` },
    forgot: { title: 'Reset Password', subtitle: 'Enter your email to receive a verification code' },
    reset: { title: 'Enter Code', subtitle: `We sent a code to ${resetEmailRef.current}` },
    face: { title: 'Face Login', subtitle: 'Secure biometric access' },
    '2fa': { title: 'Two-Factor Auth', subtitle: 'Enter your 6-digit authenticator code' },
  };

  if (!show) return null;

  const t = titles[mode] || titles.login;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) { stopFaceVideo(); onClose(); } }}
      style={{
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="relative w-[90%] max-w-[420px] z-[9999]"
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          padding: '24px 32px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.15)',
          animation: 'modalIn 0.3s ease forwards',
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={() => { stopFaceVideo(); onClose(); }}
          style={{
            position: 'absolute', top: '16px', right: '20px',
            background: 'none', border: 'none', fontSize: '22px',
            color: '#94a3b8', cursor: 'pointer', padding: '4px', lineHeight: 1,
          }}
          onMouseOver={(e) => e.currentTarget.style.color = '#0f172a'}
          onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
        >
          &times;
        </button>

        {/* Title */}
        <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
          {t.title}
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '32px' }}>
          {t.subtitle}
        </p>

        {/* Error */}
        {error && (
          <div style={{
            background: '#ffdad6', color: '#93000a', padding: '10px 14px',
            borderRadius: '10px', fontSize: '13px', fontWeight: 500, marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        {/* ═══ LOGIN FORM ═══ */}
        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Email Address</label>
              <input
                type="text" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
                <a href="#" onClick={switchToForgot} style={forgotLinkStyle}>Forgot password?</a>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? "text" : "password"} required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  style={{ ...inputStyle, paddingRight: '40px' }}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} style={primaryBtnStyle}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <button type="button" onClick={switchToFace} style={faceBtnStyle}>
              Face Login
            </button>

            {/* OR divider */}
            <div style={dividerWrapperStyle}>
              <div style={dividerLineStyle}></div>
              <span style={dividerTextStyle}>OR</span>
              <div style={dividerLineStyle}></div>
            </div>

            {/* Google Sign-In */}
            <div ref={googleBtnRef} style={{ display: 'flex', justifyContent: 'center' }}></div>

            <p style={toggleTextStyle}>
              Don't have an account?{' '}
              <a href="#" onClick={switchToSignUp} style={toggleLinkStyle}>Sign up</a>
            </p>
          </form>
        )}

        {/* ═══ SIGNUP FORM ═══ */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Full Name</label>
              <input
                type="text" required value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Email Address</label>
              <input
                type="text" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? "text" : "password"} required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  style={{ ...inputStyle, paddingRight: '40px' }}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} style={primaryBtnStyle}>
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>

            {/* OR divider */}
            <div style={dividerWrapperStyle}>
              <div style={dividerLineStyle}></div>
              <span style={dividerTextStyle}>OR</span>
              <div style={dividerLineStyle}></div>
            </div>

            {/* Google Sign-In */}
            <div ref={googleBtnRef} style={{ display: 'flex', justifyContent: 'center' }}></div>

            <p style={toggleTextStyle}>
              Already have an account?{' '}
              <a href="#" onClick={switchToLogin} style={toggleLinkStyle}>Sign in</a>
            </p>
          </form>
        )}

        {/* ═══ EMAIL VERIFICATION FORM ═══ */}
        {mode === 'verify' && (
          <form onSubmit={handleVerifyEmail}>
            <div style={{ marginBottom: '24px', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
                We've sent a 6-digit verification code to:
              </p>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>{verifyEmailRef.current}</div>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>Verification Code</label>
              <input
                type="text" required value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="123456" maxLength={6}
                style={{ ...inputStyle, textAlign: 'center', letterSpacing: '4px', fontSize: '20px', fontWeight: 600 }}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            <button type="submit" disabled={loading} style={primaryBtnStyle}>
              {loading ? 'Verifying...' : 'Verify Email & Login'}
            </button>
            <p style={{ ...toggleTextStyle, marginTop: '16px' }}>
              Didn't receive the code?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); handleResendVerification(); }} style={toggleLinkStyle}>
                Resend Code
              </a>
            </p>
            <p style={toggleTextStyle}>
              <a href="#" onClick={switchToLogin} style={toggleLinkStyle}>Cancel</a>
            </p>
          </form>
        )}

        {/* ═══ FORGOT PASSWORD FORM ═══ */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Email Address</label>
              <input
                type="email" required value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            <button type="submit" disabled={loading} style={primaryBtnStyle}>
              {loading ? 'Sending...' : 'Send Verification Code'}
            </button>
            <p style={toggleTextStyle}>
              <a href="#" onClick={switchToLogin} style={toggleLinkStyle}>Back to Sign In</a>
            </p>
          </form>
        )}

        {/* ═══ RESET PASSWORD FORM ═══ */}
        {mode === 'reset' && (
          <form onSubmit={handleResetPassword}>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
              Check your email (or terminal) for the 6-digit code.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Verification Code</label>
              <input
                type="text" required value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                placeholder="123456" maxLength={6}
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>New Password</label>
              <input
                type="password" required value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password" minLength={6}
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Confirm Password</label>
              <input
                type="password" required value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Retype new password" minLength={6}
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            <button type="submit" disabled={loading} style={primaryBtnStyle}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}

        {/* ═══ 2FA FORM ═══ */}
        {mode === '2fa' && (
          <form onSubmit={handle2FASubmit}>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px', textAlign: 'center' }}>
              Two-Factor Authentication is enabled. Please enter your 6-digit code.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Authentication Code</label>
              <input
                type="text" required value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder="123456" maxLength={6}
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            <button type="submit" disabled={loading} style={primaryBtnStyle}>
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
            <p style={toggleTextStyle}>
              <a href="#" onClick={switchToLogin} style={toggleLinkStyle}>Cancel</a>
            </p>
          </form>
        )}

        {/* ═══ FACE LOGIN FORM ═══ */}
        {mode === 'face' && (
          <form onSubmit={handleFaceLogin}>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', textAlign: 'center' }}>
              Enter your email and look at the camera.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Email Address</label>
              <input
                type="email" required value={faceEmail}
                onChange={(e) => setFaceEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            <div style={{
              width: '100%', height: '200px', background: '#000',
              borderRadius: '12px', overflow: 'hidden', marginBottom: '16px',
              position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center',
            }}>
              <video ref={videoRef} autoPlay muted playsInline style={{ height: '100%' }} />
              {faceLoading && !faceModelsLoaded && (
                <div style={{ position: 'absolute', color: 'white', fontSize: '14px' }}>
                  Loading models...
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !faceModelsLoaded}
              style={primaryBtnStyle}
            >
              {loading ? 'Scanning...' : 'Verify Face & Login'}
            </button>
            <p style={toggleTextStyle}>
              <a href="#" onClick={(e) => { e.preventDefault(); switchFromFace(); }} style={toggleLinkStyle}>
                Back to Password Sign In
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

// ─── Shared Inline Styles ──────────────────────────

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#475569',
  marginBottom: '6px',
};

const inputStyle = {
  width: '100%',
  padding: '12px 16px',
  border: '1.5px solid #cbd5e1',
  borderRadius: '12px',
  fontSize: '15px',
  fontFamily: "'Inter', sans-serif",
  background: '#f8fafc',
  color: '#0f172a',
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  boxSizing: 'border-box',
};

const handleInputFocus = (e) => {
  e.target.style.borderColor = '#3b82f6';
  e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)';
};

const handleInputBlur = (e) => {
  e.target.style.borderColor = '#cbd5e1';
  e.target.style.boxShadow = 'none';
};

const primaryBtnStyle = {
  width: '100%',
  padding: '14px',
  background: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 700,
  fontFamily: "'Inter', sans-serif",
  border: 'none',
  borderRadius: '12px',
  cursor: 'pointer',
  transition: 'opacity 0.2s, transform 0.15s, box-shadow 0.15s',
  marginTop: '8px',
  boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
};

const faceBtnStyle = {
  width: '100%',
  padding: '14px',
  background: '#0f172a',
  color: '#fff',
  fontSize: '15px',
  fontWeight: 700,
  fontFamily: "'Inter', sans-serif",
  border: 'none',
  borderRadius: '12px',
  marginTop: '8px',
  cursor: 'pointer',
  transition: 'opacity 0.2s',
};

const forgotLinkStyle = {
  fontSize: '12px',
  fontWeight: 700,
  color: '#2563eb',
  textDecoration: 'none',
};

const dividerWrapperStyle = {
  display: 'flex',
  alignItems: 'center',
  padding: '20px 0',
};

const dividerLineStyle = {
  flex: 1,
  borderTop: '1px solid #e2e8f0',
};

const dividerTextStyle = {
  flexShrink: 0,
  margin: '0 16px',
  fontSize: '13px',
  fontWeight: 700,
  color: '#64748b',
};

const toggleTextStyle = {
  textAlign: 'center',
  fontSize: '13px',
  marginTop: '16px',
  color: '#64748b',
  fontWeight: 500,
};

const toggleLinkStyle = {
  color: '#2563eb',
  fontWeight: 700,
  textDecoration: 'none',
};

export default LoginModal;
