import { useState, useEffect, useRef } from 'react';
import {
  User, Eye, FileText, LogOut, Heart, EyeOff, Car, PenLine, Loader2,
  ExternalLink, Trash2, Send, Pencil, Archive, Lock, Phone, CheckCircle,
  MessageSquare, Plus, ChevronRight, AlertCircle, X, MapPin, Calendar, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link, useSearchParams } from 'react-router';
import { api } from '../api/client';
import { carsApi } from '../api/cars';
import { FavoritesPage } from './FavoritesPage';
import { useFavorites } from '../hooks/useFavorites';
import { listingsApi, type MyListing } from '../api/catalog';
import { formatCatalogId } from '../api/cars';
import { reservationsApi, type Reservation } from '../api/reservations';
import {
  ticketsApi,
  type Ticket,
  type TicketDetail,
  TICKET_TYPE_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
  type TicketType,
} from '../api/tickets';
import { useLanguage } from '../i18n/LanguageContext';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { CarImagePlaceholder } from '../components/CarImagePlaceholder';

function formatModelId(markId: string, modelId: string): string {
  const prefix = markId.toLowerCase().replace(/-/g, '_') + '_';
  const cleaned = modelId.toLowerCase().startsWith(prefix) ? modelId.slice(prefix.length) : modelId;
  return formatCatalogId(cleaned);
}

type TabType = 'profile' | 'security' | 'favorites' | 'listings' | 'drafts' | 'archive' | 'reservations' | 'tickets';

const inputCls = 'w-full px-4 py-3 bg-secondary text-foreground placeholder:text-muted-foreground rounded-lg outline-none focus:ring-2 focus:ring-primary border border-border focus:border-primary transition-colors';

export function ProfilePage() {
  const { user, login, register, logout, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabType) || 'profile';
  const setActiveTab = (tab: TabType) => setSearchParams({ tab }, { replace: true });
  const { ids: favoriteIds } = useFavorites();
  const { T } = useLanguage();
  const [activeReservationCount, setActiveReservationCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    reservationsApi.my()
      .then(data => setActiveReservationCount(data.filter(r => r.status === 'active' || r.status === 'pending_payment' || r.status === 'settling').length))
      .catch(() => {});
  }, [user]);

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    if (isRegister && password !== confirmPassword) {
      toast.error(T.profile.passwordsNotMatch);
      setAuthLoading(false);
      return;
    }
    try {
      if (isRegister) {
        await register(email, password, fullName);
        toast.success(T.profile.registerSuccess);
      } else {
        await login(email, password);
        toast.success(T.profile.welcomeBack);
      }
      window.location.reload();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : T.common.error;
      toast.error(message === 'Incorrect email or password' ? T.profile.wrongCredentials : message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success(T.profile.logoutSuccess);
    navigate('/');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/user/profile', {
        full_name: editName || undefined,
      });
      toast.success(T.profile.profileSaved);
      window.location.reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : T.common.error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <User className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-2xl font-semibold">FastAuto</span>
            </Link>
          </div>

          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="flex border-b border-border">
              <button
                onClick={() => { setIsRegister(false); setPassword(''); setConfirmPassword(''); setShowPassword(false); setShowConfirmPassword(false); }}
                className={`flex-1 py-4 text-sm font-medium transition-colors ${!isRegister ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {T.profile.signIn}
              </button>
              <button
                onClick={() => { setIsRegister(true); setPassword(''); setConfirmPassword(''); setShowPassword(false); setShowConfirmPassword(false); }}
                className={`flex-1 py-4 text-sm font-medium transition-colors ${isRegister ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {T.profile.register}
              </button>
            </div>

            <div className="p-8">
              <div className="mb-6">
                <h1 className="text-2xl font-semibold text-foreground mb-1">
                  {isRegister ? T.profile.createAccount : T.profile.welcome}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isRegister ? T.profile.registerDesc : T.profile.loginDesc}
                </p>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                {isRegister && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{T.profile.name}</label>
                    <input type="text" placeholder={T.profile.namePlaceholder} required value={fullName}
                      onChange={e => setFullName(e.target.value)} className={inputCls} autoComplete="name" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{T.profile.email}</label>
                  <input type="email" placeholder="example@mail.ru" required value={email}
                    onChange={e => setEmail(e.target.value)} className={inputCls} autoComplete="email" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-foreground">{T.profile.password}</label>
                    {!isRegister && (
                      <button type="button" className="text-xs text-primary hover:underline"
                        onClick={() => toast.info(T.profile.forgotPasswordInfo)}>
                        {T.profile.forgotPassword}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder={isRegister ? T.profile.passwordMin : '••••••••'}
                      required value={password} onChange={e => setPassword(e.target.value)}
                      className={inputCls + ' pr-12'}
                      autoComplete={isRegister ? 'new-password' : 'current-password'}
                    />
                    <button type="button" onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {isRegister && password.length > 0 && <PasswordStrength password={password} />}
                </div>
                {isRegister && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{T.profile.confirmPassword}</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder={T.profile.repeatPassword} required value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className={inputCls + ' pr-12' + (confirmPassword.length > 0 && confirmPassword !== password ? ' border-destructive focus:ring-destructive' : '')}
                        autoComplete="new-password"
                      />
                      <button type="button" onClick={() => setShowConfirmPassword(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPassword.length > 0 && confirmPassword !== password && (
                      <p className="mt-1 text-xs text-destructive">{T.profile.passwordsNotMatch}</p>
                    )}
                  </div>
                )}
                <button type="submit" disabled={authLoading}
                  className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:scale-100 disabled:shadow-none font-medium mt-2">
                  {authLoading
                    ? <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                        {isRegister ? T.profile.registering : T.profile.logging}
                      </span>
                    : isRegister ? T.profile.registerBtn : T.profile.signInBtn
                  }
                </button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-card text-muted-foreground">
                    {isRegister ? T.profile.alreadyHaveAccount : T.profile.noAccount}
                  </span>
                </div>
              </div>

              <button
                onClick={() => { setIsRegister(!isRegister); setPassword(''); setConfirmPassword(''); setShowPassword(false); setShowConfirmPassword(false); }}
                className="w-full px-6 py-3 bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-all duration-200 hover:scale-[1.02] border border-border text-sm font-medium">
                {isRegister ? T.profile.signInExisting : T.profile.createNew}
              </button>
            </div>
          </div>

          <p className="text-center mt-6 text-sm text-muted-foreground">
            <Link to="/" className="text-primary hover:underline">{T.profile.backToHome}</Link>
          </p>
        </div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'profile',       label: T.profile.tabs.profile,       icon: User },
    { id: 'security',      label: T.profile.tabs.security,      icon: Lock },
    { id: 'favorites',     label: T.profile.tabs.favorites,     icon: Heart, badge: favoriteIds.length },
    { id: 'listings',      label: T.profile.tabs.listings,      icon: Car },
    { id: 'drafts',        label: T.profile.tabs.drafts,        icon: PenLine },
    { id: 'archive',       label: T.profile.tabs.archive,       icon: Archive },
    { id: 'reservations',  label: T.profile.tabs.reservations,  icon: FileText, badge: activeReservationCount },
    { id: 'tickets',       label: T.profile.tabs.tickets,       icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-semibold text-foreground mb-8">{T.profile.cabinet}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <aside className="lg:col-span-1">
            <div className="bg-card rounded-lg border border-border p-4 space-y-1">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary text-foreground'}`}>
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <span>{tab.label}</span>
                    </div>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
              <div className="pt-1 border-t border-border mt-1">
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-destructive/10 text-destructive transition-colors">
                  <LogOut className="w-5 h-5" />
                  <span>{T.profile.sidebar.logout}</span>
                </button>
              </div>
            </div>
          </aside>

          <div className="lg:col-span-3">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-2xl font-semibold">
                      {user.full_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold text-foreground">{user.full_name}</h2>
                      <p className="text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-muted-foreground mt-1 capitalize">
                        {T.profile.profileTab.role}: {T.profile.profileTab.roles[user.role as keyof typeof T.profile.profileTab.roles] ?? user.role}
                      </p>
                    </div>
                  </div>
                  <form className="space-y-4" onSubmit={handleSaveProfile}>
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">{T.profile.profileTab.editName}</label>
                      <input type="text" placeholder={user.full_name} value={editName}
                        onChange={e => setEditName(e.target.value)} className={inputCls} />
                    </div>
                    <button type="submit" disabled={saving}
                      className="px-6 py-3 bg-primary text-primary-foreground rounded-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:scale-100 disabled:shadow-none">
                      {saving ? T.profile.profileTab.saving : T.profile.profileTab.save}
                    </button>
                  </form>
                </div>

                <PhoneVerification phone={user.phone} userId={user.id} />
              </div>
            )}

            {activeTab === 'security' && <SecurityTab />}
            {activeTab === 'listings' && <MyListingsTab />}
            {activeTab === 'drafts' && <DraftsTab />}
            {activeTab === 'archive' && <ArchiveTab />}
            {activeTab === 'reservations' && <ReservationsTab userId={user.id} />}
            {activeTab === 'tickets' && <TicketsTab userId={user.id} />}
            {activeTab === 'favorites' && <FavoritesPage />}
          </div>
        </div>
      </div>
    </div>
  );
}

// PasswordStrength

function PasswordStrength({ password }: { password: string }) {
  const { T } = useLanguage();
  const score = [
    password.length >= 8,
    /[A-ZА-ЯЁ]/.test(password),
    /\d/.test(password),
  ].filter(Boolean).length;
  const colors = ['bg-destructive', 'bg-yellow-500', 'bg-accent', 'bg-accent'];
  const labels = T.profile.pwdStrength;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < score ? colors[score] : 'bg-border'}`} />
        ))}
      </div>
      {score > 0 && (
        <p className={`text-xs ${score === 3 ? 'text-accent' : score === 2 ? 'text-yellow-500' : 'text-destructive'}`}>
          {labels[score]}
        </p>
      )}
    </div>
  );
}

// SecurityTab

function SecurityTab() {
  const { T } = useLanguage();
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) { toast.error(T.profile.settingsTab.newPasswordsNotMatch); return; }
    if (newPwd.length < 8) { toast.error(T.profile.settingsTab.passwordTooShort); return; }
    setSaving(true);
    try {
      await api.patch('/auth/me/password', {
        current_password: currentPwd,
        new_password: newPwd,
      });
      toast.success(T.profile.settingsTab.passwordChanged);
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : T.common.error;
      if (msg.includes('incorrect') || msg.includes('Incorrect')) {
        toast.error(T.profile.settingsTab.wrongCurrentPassword);
      } else {
        toast.error(msg || T.common.error);
      }
    } finally {
      setSaving(false);
    }
  };

  const EyeBtn = ({ show, toggle }: { show: boolean; toggle: () => void }) => (
    <button type="button" onClick={toggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h2 className="text-2xl font-semibold text-foreground mb-1">{T.profile.settingsTab.title}</h2>
      <p className="text-sm text-muted-foreground mb-6">{T.profile.settingsTab.subtitle}</p>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">{T.profile.settingsTab.currentPassword}</label>
          <div className="relative">
            <input type={showCurrent ? 'text' : 'password'} required value={currentPwd}
              onChange={e => setCurrentPwd(e.target.value)}
              placeholder={T.profile.settingsTab.currentPasswordPlaceholder}
              className={inputCls + ' pr-12'} autoComplete="current-password" />
            <EyeBtn show={showCurrent} toggle={() => setShowCurrent(p => !p)} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">{T.profile.settingsTab.newPassword}</label>
          <div className="relative">
            <input type={showNew ? 'text' : 'password'} required value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              placeholder={T.profile.passwordMin}
              className={inputCls + ' pr-12'} autoComplete="new-password" />
            <EyeBtn show={showNew} toggle={() => setShowNew(p => !p)} />
          </div>
          {newPwd.length > 0 && <PasswordStrength password={newPwd} />}
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">{T.profile.settingsTab.confirmNewPassword}</label>
          <input type="password" required value={confirmPwd}
            onChange={e => setConfirmPwd(e.target.value)}
            placeholder={T.profile.settingsTab.repeatPasswordPlaceholder}
            className={inputCls + (confirmPwd.length > 0 && confirmPwd !== newPwd ? ' border-destructive' : '')}
            autoComplete="new-password" />
          {confirmPwd.length > 0 && confirmPwd !== newPwd && (
            <p className="mt-1 text-xs text-destructive">{T.profile.passwordsNotMatch}</p>
          )}
        </div>
        <button type="submit" disabled={saving || (confirmPwd.length > 0 && confirmPwd !== newPwd)}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:scale-100 disabled:shadow-none">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? T.profile.settingsTab.saving : T.profile.settingsTab.changePassword}
        </button>
      </form>
    </div>
  );
}

// PhoneVerification

function PhoneVerification({ phone, userId }: { phone: string | null; userId: string }) {
  const { T } = useLanguage();
  const PV = T.profile.phoneVerification;
  const STORAGE_KEY = `phone_verified_${userId}`;
  const [phoneInput, setPhoneInput] = useState(phone ?? '');
  const [otpCode, setOtpCode] = useState('');
  const [stage, setStage] = useState<'idle' | 'sent' | 'done'>(() =>
    localStorage.getItem(`phone_verified_${userId}`) ? 'done' : 'idle'
  );
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = (sec: number) => {
    setCooldown(sec);
    timerRef.current = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    if (!phoneInput.trim()) { toast.error(PV.enterPhone); return; }
    setSending(true);
    try {
      const res = await api.post<{ cooldown_seconds?: number }>('/auth/phone/send-otp', {
        phone: phoneInput.trim(),
        purpose: 'phone_verify',
      });
      setStage('sent');
      startCooldown(res?.cooldown_seconds ?? 60);
      toast.success(PV.codeSent);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : T.common.error;
      if (msg.includes('already linked')) toast.error(PV.alreadyLinked);
      else if (msg.includes('Too Many Requests') || msg.includes('429')) toast.error(PV.waitResend);
      else toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (!otpCode.trim()) { toast.error(PV.enterCode); return; }
    setVerifying(true);
    try {
      await api.post('/auth/phone/verify-otp', {
        phone: phoneInput.trim(),
        code: otpCode.trim(),
      });
      localStorage.setItem(STORAGE_KEY, '1');
      setStage('done');
      toast.success(PV.codeVerified);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : T.common.error;
      if (msg.includes('expired') || msg.includes('Expired')) toast.error(PV.codeExpired);
      else if (msg.includes('Invalid') || msg.includes('invalid')) toast.error(PV.invalidCode);
      else toast.error(msg);
    } finally {
      setVerifying(false);
    }
  };

  if (stage === 'done') {
    return (
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-8 h-8 text-accent" />
          <div>
            <p className="font-semibold text-foreground">{PV.verifiedTitle}</p>
            <p className="text-sm text-muted-foreground">{phoneInput}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center gap-3 mb-4">
        <Phone className="w-5 h-5 text-muted-foreground" />
        <div>
          <h3 className="font-semibold text-foreground">{PV.title}</h3>
          <p className="text-xs text-muted-foreground">
            {phone ? PV.confirmDesc : PV.addDesc}
          </p>
        </div>
      </div>
      <div className="space-y-3 w-full max-w-sm min-w-[280px]">
        <div className="flex gap-2">
          <input
            type="tel"
            value={phoneInput}
            onChange={e => setPhoneInput(e.target.value)}
            placeholder={T.profile.phonePlaceholder}
            className={inputCls + ' flex-1 min-w-0'}
            disabled={stage === 'sent'}
          />
          <button
            onClick={handleSendOtp}
            disabled={sending || cooldown > 0 || stage === 'sent'}
            className="w-[120px] flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-3 bg-primary text-primary-foreground rounded-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:scale-100 disabled:shadow-none text-sm font-medium">
            {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {cooldown > 0 ? `${cooldown}${PV.secsUnit}` : stage === 'sent' ? PV.sentBtn : PV.getCodeBtn}
          </button>
        </div>
        {stage === 'sent' && (
          <div className="flex gap-2">
            <input
              type="text"
              value={otpCode}
              onChange={e => setOtpCode(e.target.value)}
              placeholder={PV.codePlaceholder}
              maxLength={6}
              className={inputCls + ' flex-1 min-w-0 text-center tracking-widest'}
            />
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="w-[120px] flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-3 bg-accent text-accent-foreground rounded-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-accent/25 disabled:opacity-50 disabled:scale-100 disabled:shadow-none text-sm font-medium">
              {verifying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {PV.verifyBtn}
            </button>
          </div>
        )}
        {stage === 'sent' && cooldown === 0 && (
          <button onClick={() => { setStage('idle'); setOtpCode(''); }}
            className="text-xs text-primary hover:underline">
            {PV.newCodeBtn}
          </button>
        )}
      </div>
    </div>
  );
}

// ReservationsTab

const RES_STATUS_COLORS: Record<string, string> = {
  pending_payment: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  active: 'bg-accent/10 text-accent',
  settling: 'bg-accent/10 text-accent',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
};

function isPaid(r: { status: string; yk_payment_id: string | null }): boolean {
  return r.status === 'active' || r.status === 'settling' || r.status === 'completed'
    || (r.status === 'pending_payment' && r.yk_payment_id !== null);
}

function matchesFilter(r: { status: string; yk_payment_id: string | null }, filter: string): boolean {
  if (!filter) return true;
  if (filter === 'active') return isPaid(r) && r.status !== 'completed';
  if (filter === 'pending_payment') return r.status === 'pending_payment' && !r.yk_payment_id;
  return r.status === filter;
}

function ReservationsTab({ userId }: { userId: string }) {
  const { lang, T } = useLanguage();
  const RT = T.profile.reservationsTab;

  const RES_STATUS_LABELS: Record<string, string> = {
    pending_payment: RT.statusLabels.pending_payment,
    active: RT.statusLabels.paid,
    settling: RT.statusLabels.paid,
    completed: RT.statusLabels.completed,
    cancelled: RT.statusLabels.cancelled,
  };

  const getResDisplay = (r: { status: string; yk_payment_id: string | null }): { label: string; color: string } => {
    if (r.status === 'pending_payment' && r.yk_payment_id !== null) {
      return { label: RT.statusLabels.paid, color: RES_STATUS_COLORS.active };
    }
    return {
      label: RES_STATUS_LABELS[r.status] ?? r.status,
      color: RES_STATUS_COLORS[r.status] ?? 'bg-secondary text-muted-foreground',
    };
  };

  const RES_FILTER_OPTIONS: { value: string; label: string }[] = [
    { value: 'pending_payment', label: RT.filterPending },
    { value: 'active',          label: RT.filterPaid },
    { value: 'completed',       label: RT.filterCompleted },
    { value: 'cancelled',       label: RT.filterCancelled },
  ];

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [carsMap, setCarsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [payingNow, setPayingNow] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [declineConfirm, setDeclineConfirm] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const REVEALED = ['active', 'settling', 'completed'];

  const load = async () => {
    setLoading(true);
    try {
      const data = await reservationsApi.my();
      setReservations(data);

      // Параллельно: детали машин + детали броней (для seller_phone / sale_address)
      const uniqueIds = [...new Set(data.map(r => r.listing_id))];
      const toEnrich = data.filter(r => REVEALED.includes(r.status));

      const [carResults, detailResults] = await Promise.all([
        Promise.allSettled(uniqueIds.map(id => carsApi.get(id))),
        Promise.allSettled(toEnrich.map(r => reservationsApi.get(r.id))),
      ]);

      // Карта авто
      const map: Record<string, string> = {};
      carResults.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          const c = r.value;
          map[uniqueIds[i]] = `${c.brand} ${c.model} ${c.year}`;
        }
      });
      setCarsMap(map);

      // Мержим seller_phone / sale_address в список броней
      const detailMap: Record<string, Partial<Reservation>> = {};
      toEnrich.forEach((r, i) => {
        const result = detailResults[i];
        if (result.status === 'fulfilled') {
          detailMap[r.id] = {
            seller_phone: result.value.seller_phone,
            sale_address: result.value.sale_address,
          };
        }
      });

      setReservations(data.map(r => ({ ...r, ...(detailMap[r.id] ?? {}) })));
    } catch {
      setReservations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCancel = async (id: string) => {
    setCancelling(id);
    try {
      await reservationsApi.cancel(id);
      toast.success(RT.cancelDeposit);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : RT.cancelError);
    } finally {
      setCancelling(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await reservationsApi.delete(id);
      setReservations(prev => prev.filter(r => r.id !== id));
      toast.success(RT.deleteSuccess ?? 'Запись удалена');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : RT.cancelError);
    } finally {
      setDeleting(null);
    }
  };

  const handlePayNow = async (reservationId: string, listingId: string) => {
    setPayingNow(reservationId);
    try {
      const result = await reservationsApi.reserve(listingId);
      if (result.payment_url) {
        window.open(result.payment_url, '_blank');
      } else {
        toast.info(RT.alreadyPaid);
        load();
      }
    } catch {
      toast.error(RT.payError);
    } finally {
      setPayingNow(null);
    }
  };

  const handleDecline = async () => {
    if (!declineConfirm || !declineReason.trim()) return;
    const id = declineConfirm;
    setDeclining(id);
    setDeclineConfirm(null);
    try {
      await reservationsApi.decline(id, declineReason.trim());
      toast.success(RT.declineSuccess);
      setDeclineReason('');
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : T.common.error);
    } finally {
      setDeclining(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-lg border border-border p-12 text-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (reservations.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-12 text-center">
        <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-30" />
        <h3 className="text-xl font-semibold text-foreground mb-2">{RT.empty}</h3>
        <p className="text-muted-foreground mb-4">{RT.paymentWarning}</p>
        <Link to="/catalog" className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90">
          {RT.toCatalog}
        </Link>
      </div>
    );
  }

  const filtered = reservations.filter(r => matchesFilter(r, filterStatus));
  const dateFmt = lang === 'ru' ? 'ru-RU' : 'en-US';

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-2xl font-semibold text-foreground">
            {RT.title}{' '}
            <span className="text-muted-foreground text-lg font-normal">({filtered.length})</span>
          </h2>
          {filterStatus && (
            <button
              onClick={() => setFilterStatus('')}
              className="flex items-center gap-1.5 px-3 py-2 bg-destructive/10 text-destructive rounded-lg text-sm hover:bg-destructive/20 transition-colors">
              <X className="w-4 h-4" /> {T.common.reset}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5 bg-secondary/50 rounded-lg px-2 py-1.5 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">{RT.statusFilter}</span>
            <button
              onClick={() => setFilterStatus('')}
              className={`text-xs px-2 py-0.5 rounded-full transition-colors ${!filterStatus ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
              {RT.filterAll}
            </button>
            {RES_FILTER_OPTIONS.map(({ value, label }) => (
              <button key={value} onClick={() => setFilterStatus(filterStatus === value ? '' : value)}
                className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                  filterStatus === value
                    ? `${RES_STATUS_COLORS[value]} ring-2 ring-offset-1 ring-primary/20`
                    : 'text-muted-foreground bg-secondary hover:bg-secondary/80'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 && (
          <div className="bg-card rounded-lg border border-border p-8 text-center">
            <p className="text-muted-foreground text-sm">{RT.noStatusMatch}</p>
          </div>
        )}

        {filtered.map(r => {
          const isBuyer = r.buyer_id === userId;
          const isSeller = r.seller_id === userId;
          const { label: rLabel, color: rColor } = getResDisplay(r);

          return (
            <div key={r.id} className="bg-card rounded-lg border border-border p-6 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25 cursor-default">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Link to={`/car/${r.listing_id}`}
                      className="font-semibold text-foreground hover:text-primary transition-colors">
                      {carsMap[r.listing_id] ?? RT.car}
                    </Link>
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      {isBuyer ? RT.buyer : RT.seller}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {new Date(r.created_at).toLocaleDateString(dateFmt, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  {r.window_date && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <span className="flex items-center gap-1 text-sm text-primary font-medium">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(`${r.window_date}T00:00:00`).toLocaleDateString(dateFmt, { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                      {r.time_from && r.time_to && (
                        <span className="flex items-center gap-1 text-sm text-primary font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          {r.time_from} – {r.time_to}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {RT.depositLabel} {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(r.deposit_amount)}
                  </p>
                </div>
                <span className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium ${rColor}`}>
                  {rLabel}
                </span>
              </div>

              {isBuyer && isPaid(r) && (
                <div className="mt-3 p-3 rounded-lg bg-accent/5 border border-accent/20 space-y-2">
                  <p className="text-xs font-semibold text-accent uppercase tracking-wide">{RT.sellerContacts}</p>
                  {r.seller_phone ? (
                    <a href={`tel:${r.seller_phone}`}
                      className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors">
                      <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      {r.seller_phone}
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Phone className="w-4 h-4 flex-shrink-0" /> {RT.noPhone}
                    </p>
                  )}
                  {r.sale_address ? (
                    <p className="flex items-start gap-2 text-sm text-foreground">
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      {r.sale_address}
                    </p>
                  ) : (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 flex-shrink-0" /> {RT.noAddress}
                    </p>
                  )}
                  <Link
                    to={`/car/${r.listing_id}`}
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline font-medium mt-1">
                    <ExternalLink className="w-3.5 h-3.5" /> {RT.openListing}
                  </Link>
                </div>
              )}

              {isBuyer && r.status === 'pending_payment' && !r.yk_payment_id && (
                <div className="mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm text-yellow-700 dark:text-yellow-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    {RT.payDeadlinePrefix}
                    {new Date(r.payment_deadline).toLocaleString(dateFmt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {RT.payDeadlineSuffix}
                  </span>
                </div>
              )}

              {/* Итог завершённой брони */}
              {r.status === 'completed' && r.outcome && (
                <div className={`mt-3 p-3 rounded-lg border flex items-center gap-2 text-sm font-medium ${
                  r.outcome === 'sold'
                    ? 'bg-accent/10 border-accent/30 text-accent'
                    : 'bg-muted border-border text-muted-foreground'
                }`}>
                  {r.outcome === 'sold'
                    ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    : <X className="w-4 h-4 flex-shrink-0" />}
                  <span>
                    {r.outcome === 'sold' ? RT.outcomeCompletedSold : RT.outcomeCompletedNotSold}
                    {r.outcome_set_at && (
                      <span className="font-normal text-xs ml-2 opacity-70">
                        {RT.outcomeSetAt} {new Date(r.outcome_set_at).toLocaleDateString(dateFmt, { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-4">
                {isBuyer && r.status === 'pending_payment' && !r.yk_payment_id && (
                  <button
                    onClick={() => handlePayNow(r.id, r.listing_id)}
                    disabled={payingNow === r.id}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:scale-100 disabled:shadow-none">
                    {payingNow === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    {RT.payNow}
                  </button>
                )}

                {isBuyer && (r.status === 'pending_payment' || r.status === 'active') && (
                  <button
                    onClick={() => handleCancel(r.id)}
                    disabled={cancelling === r.id}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm text-destructive border border-destructive/50 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-50">
                    {cancelling === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    {RT.cancelBookingBtn}
                  </button>
                )}

                {(isBuyer || isSeller) && (r.status === 'active' || r.status === 'settling') && (
                  <ReservationOutcomeButtons
                    reservationId={r.id}
                    reservation={r}
                    userId={userId}
                    onDone={load}
                  />
                )}

                {isSeller && (r.status === 'pending_payment' || r.status === 'active') && (
                  <button
                    onClick={() => setDeclineConfirm(r.id)}
                    disabled={declining === r.id}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm text-destructive border border-destructive/50 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-50">
                    {declining === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    {RT.declineBookingBtn}
                  </button>
                )}

                {r.status === 'cancelled' && (
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={deleting === r.id}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-colors disabled:opacity-50">
                    {deleting === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    {RT.deleteBtn ?? 'Удалить'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {declineConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => { setDeclineConfirm(null); setDeclineReason(''); }} />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-foreground mb-2">{RT.declineTitle}</h3>
            <p className="text-sm text-muted-foreground mb-4">{RT.declineText}</p>
            <textarea
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              placeholder={RT.declineReason}
              rows={3}
              maxLength={300}
              className={inputCls + ' resize-none mb-1'}
            />
            <p className="text-xs text-muted-foreground text-right mb-4">{declineReason.length}/300</p>
            <div className="flex gap-3">
              <button onClick={() => { setDeclineConfirm(null); setDeclineReason(''); }}
                className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors">
                {T.common.cancel}
              </button>
              <button
                onClick={handleDecline}
                disabled={!declineReason.trim() || !!declining}
                className="flex-1 flex justify-center items-center gap-2 px-4 py-2 text-sm bg-destructive text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
                {declining ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {RT.declineBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ReservationOutcomeButtons({
  reservationId,
  reservation,
  userId,
  onDone,
}: {
  reservationId: string;
  reservation: Reservation;
  userId: string;
  onDone: () => void;
}) {
  const { lang, T } = useLanguage();
  const RT = T.profile.reservationsTab;
  const [saving, setSaving] = useState(false);

  const isSettling = reservation.status === 'settling';
  // Определяем: я уже отметил или нет
  const myRole = reservation.buyer_id === userId ? 'buyer' : 'seller';
  const iAlreadyMarked = isSettling && reservation.outcome_set_by === myRole;
  // Что отметил первый участник (когда settling и я — второй)
  const otherAlreadyMarked = isSettling && reservation.outcome_set_by !== null && !iAlreadyMarked;

  const mark = async (result: 'sold' | 'not_sold') => {
    setSaving(true);
    try {
      await reservationsApi.markOutcome(reservationId, result);
      toast.success(result === 'sold' ? RT.soldSuccess : RT.notSoldSuccess);
      onDone();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : T.common.error);
    } finally {
      setSaving(false);
    }
  };

  const dateFmt = lang === 'ru' ? 'ru-RU' : 'en-US';

  // Если я уже отметил — показываем ожидание второй стороны
  if (iAlreadyMarked) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-muted-foreground w-full">
        <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
        <span>
          {reservation.outcome === 'sold' ? RT.outcomeSold : RT.outcomeNotSold}
          {' · '}{RT.outcomeAwaitingYours.toLowerCase().replace('вашей', 'ответа другой стороны').replace('your', 'other party')}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {/* Заголовок секции */}
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {isSettling ? RT.outcomeSettlingDesc : RT.outcomeTitle}
      </div>

      {/* Что отметил первый участник */}
      {otherAlreadyMarked && reservation.outcome && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
          reservation.outcome === 'sold'
            ? 'bg-accent/10 border-accent/30 text-accent'
            : 'bg-muted border-border text-muted-foreground'
        }`}>
          {reservation.outcome === 'sold'
            ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
            : <X className="w-4 h-4 flex-shrink-0" />}
          <span>
            {RT.outcomeSetBy}: <strong>
              {reservation.outcome === 'sold' ? RT.outcomeSold : RT.outcomeNotSold}
            </strong>
            {reservation.outcome_set_at && (
              <span className="opacity-60 ml-1.5 font-normal">
                · {new Date(reservation.outcome_set_at).toLocaleDateString(dateFmt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Кнопки выбора */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => mark('sold')} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-accent text-accent-foreground rounded-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-accent/25 disabled:opacity-50 disabled:scale-100 disabled:shadow-none">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {RT.soldBtn}
        </button>
        <button onClick={() => mark('not_sold')} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors disabled:opacity-50">
          {RT.notSoldBtn}
        </button>
      </div>
    </div>
  );
}

// TicketsTab

function TicketsTab({ userId }: { userId: string }) {
  const { lang, T } = useLanguage();
  const TK = T.profile.ticketsTab;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [newType, setNewType] = useState<TicketType>('support_inquiry');
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);

  const dateFmt = lang === 'ru' ? 'ru-RU' : 'en-US';

  const loadList = async () => {
    setLoading(true);
    try { setTickets(await ticketsApi.my()); }
    catch { setTickets([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadList(); }, []);

  const openTicket = async (id: string) => {
    setDetailLoading(true);
    setView('detail');
    try { setSelectedTicket(await ticketsApi.get(id)); }
    catch { toast.error(TK.loadError); setView('list'); }
    finally { setDetailLoading(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) { toast.error(TK.enterDescription); return; }
    setCreating(true);
    try {
      const t = await ticketsApi.create({ type: newType, title: newTitle.trim() });
      toast.success(TK.created);
      setTickets(prev => [t, ...prev]);
      setNewTitle('');
      setView('list');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : T.common.error);
    } finally {
      setCreating(false);
    }
  };

  const handleSendMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgText.trim() || !selectedTicket) return;
    setSending(true);
    try {
      const msg = await ticketsApi.addMessage(selectedTicket.ticket.id, msgText.trim());
      setSelectedTicket(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : prev);
      setMsgText('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : T.common.error);
    } finally {
      setSending(false);
    }
  };

  if (view === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-foreground">{TK.title}</h2>
          <button onClick={() => setView('create')}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25">
            <Plus className="w-4 h-4" /> {TK.newTicket}
          </button>
        </div>

        {loading ? (
          <div className="bg-card rounded-lg border border-border p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-card rounded-lg border border-border p-12 text-center">
            <MessageSquare className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-30" />
            <h3 className="text-xl font-semibold text-foreground mb-2">{TK.empty}</h3>
            <p className="text-muted-foreground mb-4">{TK.emptyDesc}</p>
            <button onClick={() => setView('create')}
              className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90">
              {TK.create}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map(t => (
              <button key={t.id} onClick={() => openTicket(t.id)}
                className="w-full bg-card rounded-lg border border-border p-4 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {TICKET_TYPE_LABELS[t.type]} •{' '}
                      {new Date(t.created_at).toLocaleDateString(dateFmt, { day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TICKET_STATUS_COLORS[t.status]}`}>
                      {TICKET_STATUS_LABELS[t.status]}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('list')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {TK.back}
          </button>
          <h2 className="text-xl font-semibold text-foreground">{TK.newTicket}</h2>
        </div>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{TK.typeLabel}</label>
            <select value={newType} onChange={e => setNewType(e.target.value as TicketType)}
              className={inputCls + ' cursor-pointer appearance-none'}>
              {(Object.entries(TICKET_TYPE_LABELS) as [TicketType, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{TK.descriptionLabel}</label>
            <textarea value={newTitle} onChange={e => setNewTitle(e.target.value)} required
              rows={4} maxLength={200} placeholder={TK.descriptionPlaceholder}
              className={inputCls + ' resize-none'} />
            <p className="text-xs text-muted-foreground mt-1 text-right">{newTitle.length}/200</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setView('list')}
              className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors">
              {T.common.cancel}
            </button>
            <button type="submit" disabled={creating}
              className="flex items-center gap-2 px-6 py-2 text-sm bg-primary text-primary-foreground rounded-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:scale-100 disabled:shadow-none">
              {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {TK.create}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (view === 'detail') {
    if (detailLoading || !selectedTicket) {
      return (
        <div className="bg-card rounded-lg border border-border p-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }

    const { ticket, messages } = selectedTicket;
    const isClosed = ticket.status === 'resolved' || ticket.status === 'closed';

    return (
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <button onClick={() => { setView('list'); setSelectedTicket(null); }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-2 inline-block">
                {TK.toList}
              </button>
              <h2 className="text-lg font-semibold text-foreground">{ticket.title}</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {TICKET_TYPE_LABELS[ticket.type]} •{' '}
                {new Date(ticket.created_at).toLocaleDateString(dateFmt, { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${TICKET_STATUS_COLORS[ticket.status]}`}>
              {TICKET_STATUS_LABELS[ticket.status]}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-4 min-h-[200px] max-h-[400px] overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{TK.waitingReply}</p>
          ) : (
            messages.map(msg => {
              const isOwn = msg.sender_id === userId;
              return (
                <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-xl px-4 py-3 ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}>
                    <p className="text-sm leading-relaxed">{msg.body}</p>
                    <p className={`text-xs mt-1 ${isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                      {new Date(msg.created_at).toLocaleTimeString(dateFmt, { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!isClosed && (
          <form onSubmit={handleSendMsg} className="p-4 border-t border-border">
            <div className="flex gap-2">
              <input value={msgText} onChange={e => setMsgText(e.target.value)}
                placeholder={TK.msgPlaceholder}
                className="flex-1 px-4 py-2.5 bg-secondary text-foreground placeholder:text-muted-foreground rounded-lg outline-none focus:ring-2 focus:ring-primary border border-border focus:border-primary transition-colors text-sm" />
              <button type="submit" disabled={sending || !msgText.trim()}
                className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:scale-100 disabled:shadow-none">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </form>
        )}
        {isClosed && (
          <div className="p-4 border-t border-border text-center text-sm text-muted-foreground">
            {TK.closed}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// Helpers

function formatPrice(p: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(p);
}
function formatMileage(m: number, lang: string) {
  return `${new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-US').format(m)} ${lang === 'ru' ? 'км' : 'km'}`;
}

const LISTING_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-secondary text-muted-foreground',
  pending_review: 'bg-primary/10 text-primary',
  active: 'bg-accent/10 text-accent',
  reserved: 'bg-yellow-500/10 text-yellow-600',
  sold: 'bg-muted text-muted-foreground',
  archived: 'bg-muted text-muted-foreground',
};

function useMyListings() {
  const [listings, setListings] = useState<MyListing[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const list = await listingsApi.my();
      setListings(list);
      // Batch-fetch full details to get images (my() endpoint doesn't return them)
      const details = await Promise.allSettled(list.map(l => listingsApi.get(l.id)));
      setListings(list.map((l, i) => {
        const result = details[i];
        if (result.status === 'fulfilled' && result.value.images?.length) {
          return { ...l, images: result.value.images };
        }
        return l;
      }));
    }
    catch { setListings([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return { listings, loading, reload: load };
}

function ListingCard({ listing, actions }: { listing: MyListing; actions?: React.ReactNode }) {
  const { lang, T } = useLanguage();
  const LT = T.profile.listingsTab;
  const AT = T.profile.archiveTab;

  const LISTING_STATUS_LABELS: Record<string, string> = {
    draft: LT.statusDraft,
    pending_review: LT.statusPending,
    active: LT.active,
    reserved: LT.statusReserved,
    sold: AT.statusSold,
    archived: AT.statusArchived,
  };

  const dateFmt = lang === 'ru' ? 'ru-RU' : 'en-US';

  const primaryImage = listing.images?.find(img => img.is_primary) ?? listing.images?.[0];

  return (
    <div className="bg-card rounded-lg border border-border p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25">
      <div className="flex items-start gap-4">
        {/* Thumbnail */}
        <Link to={`/car/${listing.id}`} className="flex-shrink-0">
          {primaryImage ? (
            <ImageWithFallback
              src={primaryImage.thumbnail_url || primaryImage.url}
              alt=""
              className="w-24 h-16 object-cover rounded-lg"
            />
          ) : (
            <div className="w-24 h-16 rounded-lg overflow-hidden">
              <CarImagePlaceholder />
            </div>
          )}
        </Link>
        <div className="flex items-start justify-between gap-3 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link to={`/car/${listing.id}`}
                className="font-semibold text-foreground hover:text-primary transition-colors truncate">
                {formatCatalogId(listing.mark_id)} {formatModelId(listing.mark_id, listing.model_id)} {listing.year}
              </Link>
              <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${LISTING_STATUS_COLORS[listing.status] ?? 'bg-secondary text-muted-foreground'}`}>
                {LISTING_STATUS_LABELS[listing.status] ?? listing.status}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
              <span className="font-medium text-foreground">{formatPrice(listing.price)}</span>
              <span>•</span>
              <span>{formatMileage(listing.mileage, lang)}</span>
              <span>•</span>
              <span>{new Date(listing.created_at).toLocaleDateString(dateFmt, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            {listing.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{listing.description}</p>
            )}
          </div>
          <Link to={`/car/${listing.id}`}
            className="p-2 text-muted-foreground hover:text-primary transition-colors flex-shrink-0" title={T.common.more}>
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>
      {actions && <div className="flex gap-2 mt-4 pt-4 border-t border-border">{actions}</div>}
    </div>
  );
}

function MyListingsTab() {
  const { T } = useLanguage();
  const LT = T.profile.listingsTab;
  const { listings, loading, reload } = useMyListings();
  const active = listings.filter(l => l.status === 'active' || l.status === 'reserved');

  const [deactivating,   setDeactivating]   = useState<string | null>(null);
  const [archiving,      setArchiving]      = useState<string | null>(null);
  const [deleting,       setDeleting]       = useState<string | null>(null);
  const [deactivateConfirm, setDeactivateConfirm] = useState<{ id: string; label: string } | null>(null);
  const [archiveConfirm,    setArchiveConfirm]    = useState<{ id: string; label: string } | null>(null);
  const [deleteConfirm,     setDeleteConfirm]     = useState<{ id: string; label: string } | null>(null);

  const makeLabel = (l: MyListing) =>
    `${formatCatalogId(l.mark_id)} ${formatModelId(l.mark_id, l.model_id)} ${l.year}`;

  const handleDeactivate = async () => {
    if (!deactivateConfirm) return;
    setDeactivating(deactivateConfirm.id);
    setDeactivateConfirm(null);
    try {
      await listingsApi.archive(deactivateConfirm.id);
      toast.success(LT.deactivatedSuccess);
      reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : T.common.error);
    } finally {
      setDeactivating(null);
    }
  };

  const handleArchive = async () => {
    if (!archiveConfirm) return;
    setArchiving(archiveConfirm.id);
    setArchiveConfirm(null);
    try {
      await listingsApi.archive(archiveConfirm.id);
      toast.success(LT.archivedSuccess);
      reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : T.common.error);
    } finally {
      setArchiving(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(deleteConfirm.id);
    setDeleteConfirm(null);
    try {
      await listingsApi.archive(deleteConfirm.id);
      toast.success(LT.deletedSuccess);
      reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : T.common.error);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-lg border border-border p-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (active.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-12 text-center">
        <Car className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-30" />
        <h3 className="text-xl font-semibold text-foreground mb-2">{LT.empty}</h3>
        <p className="text-muted-foreground mb-4">{LT.createFirst}</p>
        <Link to="/sell" className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25">
          {LT.listBtn}
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-foreground">{LT.title}</h2>
          <Link to="/sell" className="text-sm text-primary hover:underline">{LT.newBtn}</Link>
        </div>

        {active.map(l => (
          <ListingCard
            key={l.id}
            listing={l}
            actions={
              l.status === 'reserved' ? (
                <Link
                  to={`/listing/${l.id}/edit`}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors">
                  <Pencil className="w-3.5 h-3.5" /> {T.common.edit}
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => setDeactivateConfirm({ id: l.id, label: makeLabel(l) })}
                    disabled={deactivating === l.id || archiving === l.id || deleting === l.id}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/20 transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:scale-100">
                    {deactivating === l.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <EyeOff className="w-3.5 h-3.5" />}
                    {LT.deactivate}
                  </button>

                  <Link
                    to={`/listing/${l.id}/edit`}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-all duration-200 hover:scale-[1.02]">
                    <Pencil className="w-3.5 h-3.5" /> {T.common.edit}
                  </Link>

                  <button
                    onClick={() => setArchiveConfirm({ id: l.id, label: makeLabel(l) })}
                    disabled={deactivating === l.id || archiving === l.id || deleting === l.id}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:scale-100">
                    {archiving === l.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Archive className="w-3.5 h-3.5" />}
                    {LT.archive}
                  </button>

                  <button
                    onClick={() => setDeleteConfirm({ id: l.id, label: makeLabel(l) })}
                    disabled={deactivating === l.id || archiving === l.id || deleting === l.id}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-destructive border border-destructive/40 rounded-lg hover:bg-destructive/10 transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:scale-100">
                    {deleting === l.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                    {T.common.delete}
                  </button>
                </>
              )
            }
          />
        ))}
      </div>

      {deactivateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeactivateConfirm(null)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-foreground mb-2 text-center">{LT.archiveTitle}</h3>
            <p className="text-sm text-muted-foreground mb-5 text-center">
              {LT.archiveText}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeactivateConfirm(null)}
                className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors">
                {T.common.cancel}
              </button>
              <button onClick={handleDeactivate} disabled={!!deactivating}
                className="flex-1 flex justify-center items-center gap-2 px-4 py-2 text-sm bg-yellow-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
                {deactivating ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4" />}
                {LT.archiveBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {archiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setArchiveConfirm(null)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-foreground mb-2 text-center">{LT.archiveConfirmTitle}</h3>
            <p className="text-sm text-muted-foreground mb-5 text-center">
              {LT.archiveConfirmText}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setArchiveConfirm(null)}
                className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors">
                {T.common.cancel}
              </button>
              <button onClick={handleArchive} disabled={!!archiving}
                className="flex-1 flex justify-center items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
                {archiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                {LT.archiveConfirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-foreground mb-2 text-center">{LT.deleteTitle}</h3>
            <p className="text-sm text-muted-foreground mb-5 text-center">
              {LT.deleteText}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors">
                {T.common.cancel}
              </button>
              <button onClick={handleDelete} disabled={!!deleting}
                className="flex-1 flex justify-center items-center gap-2 px-4 py-2 text-sm bg-destructive text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {LT.deleteBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ArchiveTab() {
  const { T } = useLanguage();
  const AT = T.profile.archiveTab;
  const { listings, loading, reload } = useMyListings();
  const archived = listings.filter(l => l.status === 'archived' || l.status === 'sold');
  const [activating,     setActivating]     = useState<string | null>(null);
  const [deleting,       setDeleting]       = useState<string | null>(null);
  const [activateConfirm, setActivateConfirm] = useState<{ id: string; label: string } | null>(null);
  const [deleteConfirm,   setDeleteConfirm]   = useState<{ id: string; label: string } | null>(null);

  const makeLabel = (l: MyListing) =>
    `${formatCatalogId(l.mark_id)} ${formatModelId(l.mark_id, l.model_id)} ${l.year}`;

  const handleActivate = async () => {
    if (!activateConfirm) return;
    setActivating(activateConfirm.id);
    setActivateConfirm(null);
    try {
      await listingsApi.publish(activateConfirm.id);
      toast.success(AT.publishedSuccess);
      reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : T.common.error);
    } finally {
      setActivating(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(deleteConfirm.id);
    setDeleteConfirm(null);
    try {
      await listingsApi.archive(deleteConfirm.id);
      toast.success(AT.deletedSuccess);
      reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : T.common.error);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-lg border border-border p-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (archived.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-12 text-center">
        <Archive className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-30" />
        <h3 className="text-xl font-semibold text-foreground mb-2">{AT.empty}</h3>
        <p className="text-muted-foreground">{AT.statusArchived}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{AT.title}</h2>
        {archived.map(l => (
          <ListingCard
            key={l.id}
            listing={l}
            actions={
              l.status === 'sold' ? (
                <p className="text-sm text-muted-foreground italic">{AT.soldText}</p>
              ) : (
                <>
                  <button
                    onClick={() => setActivateConfirm({ id: l.id, label: makeLabel(l) })}
                    disabled={activating === l.id || deleting === l.id}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm bg-accent/10 text-accent border border-accent/30 rounded-lg hover:bg-accent/20 transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:scale-100">
                    {activating === l.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Eye className="w-3.5 h-3.5" />}
                    {AT.activate}
                  </button>

                  <button
                    onClick={() => setDeleteConfirm({ id: l.id, label: makeLabel(l) })}
                    disabled={activating === l.id || deleting === l.id}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-destructive border border-destructive/40 rounded-lg hover:bg-destructive/10 transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:scale-100">
                    {deleting === l.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                    {T.common.delete}
                  </button>
                </>
              )
            }
          />
        ))}
      </div>

      {activateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActivateConfirm(null)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-foreground mb-2 text-center">{AT.activateTitle}</h3>
            <p className="text-sm text-muted-foreground mb-5 text-center">
              {AT.activateText}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setActivateConfirm(null)}
                className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors">
                {T.common.cancel}
              </button>
              <button onClick={handleActivate} disabled={!!activating}
                className="flex-1 flex justify-center items-center gap-2 px-4 py-2 text-sm bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
                {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                {AT.activateBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-foreground mb-2 text-center">{AT.deleteTitle}</h3>
            <p className="text-sm text-muted-foreground mb-5 text-center">
              {AT.deleteText}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors">
                {T.common.cancel}
              </button>
              <button onClick={handleDelete} disabled={!!deleting}
                className="flex-1 flex justify-center items-center gap-2 px-4 py-2 text-sm bg-destructive text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {AT.deleteBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DraftsTab() {
  const { T } = useLanguage();
  const DT = T.profile.draftsTab;
  const { listings, loading, reload } = useMyListings();
  const drafts = listings.filter(l => l.status === 'draft' || l.status === 'pending_review');
  const [publishing, setPublishing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [publishConfirm, setPublishConfirm] = useState<{ id: string; label: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; label: string } | null>(null);

  const handlePublish = async () => {
    if (!publishConfirm) return;
    setPublishing(publishConfirm.id);
    setPublishConfirm(null);
    try {
      await listingsApi.publish(publishConfirm.id);
      toast.success(DT.publishedSuccess);
      reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : DT.errorPublish);
    } finally {
      setPublishing(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(deleteConfirm.id);
    setDeleteConfirm(null);
    try {
      await listingsApi.archive(deleteConfirm.id);
      toast.success(DT.deletedDraftSuccess);
      reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : DT.errorDelete);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-lg border border-border p-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-12 text-center">
        <PenLine className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-30" />
        <h3 className="text-xl font-semibold text-foreground mb-2">{DT.empty}</h3>
        <p className="text-muted-foreground mb-4">{DT.empty}</p>
        <Link to="/sell" className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25">
          {T.profile.listingsTab.listBtn}
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-foreground">{DT.title}</h2>
          <Link to="/sell" className="text-sm text-primary hover:underline">{DT.newBtn}</Link>
        </div>
        {drafts.map(l => (
          <ListingCard
            key={l.id}
            listing={l}
            actions={
              l.status === 'pending_review' ? (
                <p className="text-sm text-muted-foreground italic">{DT.pendingText}</p>
              ) : (
                <>
                  <button
                    onClick={() => setPublishConfirm({ id: l.id, label: `${formatCatalogId(l.mark_id)} ${formatModelId(l.mark_id, l.model_id)} ${l.year}` })}
                    disabled={publishing === l.id || deleting === l.id}
                    className="flex flex-1 justify-center items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:scale-100 disabled:shadow-none">
                    {publishing === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    {DT.publish}
                  </button>
                  <Link to={`/listing/${l.id}/edit`}
                    className="flex flex-1 justify-center items-center gap-1.5 px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors">
                    <Pencil className="w-3.5 h-3.5" /> {T.common.edit}
                  </Link>
                  <button
                    onClick={() => setDeleteConfirm({ id: l.id, label: `${formatCatalogId(l.mark_id)} ${formatModelId(l.mark_id, l.model_id)} ${l.year}` })}
                    disabled={publishing === l.id || deleting === l.id}
                    className="flex flex-1 justify-center items-center gap-1.5 px-4 py-2 text-sm text-destructive border border-destructive/50 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-50">
                    {deleting === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    {T.common.delete}
                  </button>
                </>
              )
            }
          />
        ))}
      </div>

      {publishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPublishConfirm(null)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-foreground mb-2 text-center">{DT.publishConfirmTitle}</h3>
            <p className="text-sm text-muted-foreground mb-5">
              {DT.publishConfirmText} <span className="font-semibold text-foreground">{publishConfirm.label}</span>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setPublishConfirm(null)} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors">{T.common.cancel}</button>
              <button onClick={handlePublish} disabled={!!publishing}
                className="flex-1 flex justify-center items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {DT.publishBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-foreground mb-2 text-center">{DT.deleteConfirmTitle}</h3>
            <p className="text-sm text-muted-foreground mb-5">
              {DT.deleteConfirmText} <span className="font-semibold text-foreground">{deleteConfirm.label}</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors">{T.common.cancel}</button>
              <button onClick={handleDelete} disabled={!!deleting}
                className="flex-1 flex justify-center items-center gap-2 px-4 py-2 text-sm bg-destructive text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {DT.deleteBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
