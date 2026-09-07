import React, { useState, useRef, useEffect, useCallback } from 'react';
import API from '../utils/api';
import { useSettings } from '../contexts/SettingsContext';

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '749609290729-7p9u9ujo98odpldasobtvqascmvejumb.apps.googleusercontent.com').replace(/['"]/g, '').trim();

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

  // Biometric login
  const [biometricEmail, setBiometricEmail] = useState('');
  const [faceCaptureStatus, setFaceCaptureStatus] = useState('');
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
    }
  }, [show]);

  // Initialize Google Sign-In button when in login/signup mode
  useEffect(() => {
    if (!show) return;
    if (mode !== 'login' && mode !== 'signup') return;

    let pollInterval = null;
    let attempts = 0;

    const initGoogle = () => {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleResponse,
            context: 'signin',
            ux_mode: 'popup',
            auto_prompt: false,
            error_callback: (err) => {
              console.warn("Google Identity Services notice:", err);
            },
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
        } catch (e) {
          console.error("Failed to render Google Sign-In button:", e);
        }
        return true;
      }
      return false;
    };

    // Try immediately; if GIS script hasn't finished loading yet, poll briefly
    if (!initGoogle()) {
      pollInterval = setInterval(() => {
        attempts++;
        if (initGoogle() || attempts > 25) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      }, 200);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
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
        // Store tokens for Bearer auth (essential for mobile app)
        if (response.data?.access_token) API.setToken(response.data.access_token);
        if (response.data?.refresh_token) API.setRefreshToken(response.data.refresh_token);
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
    setError('');
    try {
      const res = await API.request('/auth/google', {
        method: 'POST',
        body: { credential: response.credential },
      });

      const tokenData = res?.data || res;

      if (tokenData?.requires_2fa || res.requires_2fa) {
        setTempToken(tokenData?.temp_token || res.temp_token);
        setRequires2FA(true);
        setMode('2fa');
      } else {
        const accessToken = tokenData?.access_token || res?.access_token;
        const refreshToken = tokenData?.refresh_token || res?.refresh_token;

        if (accessToken) API.setToken(accessToken);
        if (refreshToken) API.setRefreshToken(refreshToken);

        API.setAuthenticated(true);
        const profile = await API.saveCurrentAccount(refreshToken);
        if (profile?.role === 'admin') {
          localStorage.setItem('admin_logged_in', 'true');
          window.location.href = '/admin';
        } else {
          window.location.href = '/app';
        }
      }
    } catch (err) {
      console.error("Google Authentication error:", err);
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

  // ─── Biometric Login ──────────────────────────────────

  const switchToBiometric = () => {
    setError('');
    setMode('biometric');
  };

  const switchFromBiometric = () => {
    setError('');
    setMode('login');
  };

  const handleBiometricLogin = async (e) => {
    e.preventDefault();
    if (!biometricEmail) {
      setError('Please enter your email first.');
      return;
    }
    
    setError('');
    
    if (faceCaptureStatus !== 'scanning') {
      // First click: Open camera and start scanning
      setFaceCaptureStatus('loading');
      try {
        if (!window.faceapi) {
          setError('Face API not loaded yet. Please wait a moment.');
          setFaceCaptureStatus('error');
          return;
        }
        const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
        await Promise.all([
          window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setFaceCaptureStatus('scanning');
      } catch (err) {
        setFaceCaptureStatus('error');
        setError('Failed to access camera or load models.');
      }
      return;
    }
    
    // Second click: Capture and verify
    if (!videoRef.current) return;
    setLoading(true);
    
    try {
      const detection = await window.faceapi.detectSingleFace(videoRef.current, new window.faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();
        
      if (!detection) {
        throw new Error('No face detected. Please ensure your face is clearly visible.');
      }
      
      const descriptor = Array.from(detection.descriptor);
      
      const finishRes = await API.request('/auth/face/login', {
        method: 'POST',
        body: { email: biometricEmail, descriptor },
      });
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(trk => trk.stop());
        streamRef.current = null;
      }
      
      if (finishRes.data?.requires_2fa || finishRes.requires_2fa) {
        setTempToken(finishRes.data?.temp_token || finishRes.temp_token);
        setRequires2FA(true);
        setMode('2fa');
      } else {
        const accessToken = finishRes.data?.access_token || finishRes.access_token;
        const refreshToken = finishRes.data?.refresh_token || finishRes.refresh_token;

        if (accessToken) API.setToken(accessToken);
        if (refreshToken) API.setRefreshToken(refreshToken);

        API.setAuthenticated(true);
        await API.saveCurrentAccount(refreshToken);
        window.location.href = '/app';
      }
    } catch (err) {
      setError(err.message || 'Biometric login failed.');
      setFaceCaptureStatus('error');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(trk => trk.stop());
        streamRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const cancelBiometric = (e) => {
    e.preventDefault();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(trk => trk.stop());
      streamRef.current = null;
    }
    setFaceCaptureStatus('');
    switchFromBiometric();
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
    biometric: { title: 'Biometric Login', subtitle: 'Secure local device access' },
    '2fa': { title: 'Two-Factor Auth', subtitle: 'Enter your 6-digit authenticator code' },
  };

  if (!show) return null;

  const t = titles[mode] || titles.login;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }}
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
          onClick={() => { onClose(); }}
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
            <button type="button" onClick={switchToBiometric} style={faceBtnStyle}>
              Biometric Login 🔐
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

        {/* ═══ BIOMETRIC LOGIN FORM ═══ */}
        {mode === 'biometric' && (
          <form onSubmit={handleBiometricLogin}>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', textAlign: 'center' }}>
              Enter your email, then click below to scan your face.
            </p>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Email Address</label>
              <input
                type="email" required value={biometricEmail}
                onChange={(e) => setBiometricEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                disabled={faceCaptureStatus === 'scanning' || faceCaptureStatus === 'loading'}
              />
            </div>
            
            {faceCaptureStatus === 'scanning' || faceCaptureStatus === 'loading' ? (
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: '12px', overflow: 'hidden', marginBottom: '12px', border: '3px solid #cbd5e1' }}>
                {faceCaptureStatus === 'loading' && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 10 }}>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                )}
                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading || (faceCaptureStatus === 'loading')}
              style={primaryBtnStyle}
            >
              {faceCaptureStatus === 'scanning' ? 'Scan Face & Verify' : faceCaptureStatus === 'loading' ? 'Loading Camera...' : 'Open Camera to Authenticate'}
            </button>
            <p style={toggleTextStyle}>
              <a href="#" onClick={cancelBiometric} style={toggleLinkStyle}>
                Cancel and go back
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
