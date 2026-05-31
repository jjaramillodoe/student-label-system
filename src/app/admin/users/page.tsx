"use client";
import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { Plus, Edit2, Trash2, Search, Mail, Shield, Loader2, AlertCircle, Users as UsersIcon, ArrowRightLeft, Eye, EyeOff, KeyRound, ShieldOff, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  school: string;
  allowedIntakeSessions?: string[];
  createdAt: string;
  lastLogin?: string;
  mfaEnabled?: boolean;
  forcePasswordChange?: boolean;
}

interface SchoolOption {
  name: string;
  active: boolean;
  intakeSessions?: string[];
}

const DEFAULT_INTAKE_SESSIONS = [
  'MORNING 8am-4pm',
  'EVENING 4pm-5pm',
  'SATURDAY',
  'MS265',
  'SSHS',
  'BUSHWICK-EVENING',
  'RIDGEWOOD',
];

const ROLE_PERMISSION_PREVIEW = {
  Admin: {
    scope: 'All schools',
    summary: 'Full system control, including user security and system setup.',
    permissions: [
      'Manage users, roles, passwords, and MFA recovery',
      'View and manage students, cabinets, reports, and audit logs across all schools',
      'Run admin tools such as seeding, cleanup, imports, duplicates, and bulk moves',
    ],
  },
  'Data Lead': {
    scope: 'Assigned school',
    summary: 'Operational lead access for managing school data and fixing records.',
    permissions: [
      'Manage students, cabinets, imports, duplicates, unassigned queues, and bulk moves',
      'Review audit activity and reports for their school',
      'Cannot manage user accounts, reset passwords, disable MFA, or clear all data',
    ],
  },
  'Data Member': {
    scope: 'Assigned school',
    summary: 'Day-to-day student record and label printing access.',
    permissions: [
      'View, add, edit, print, and export student records for their school',
      'Use saved searches, filters, QR codes, and basic dashboard actions',
      'Cannot access admin tools, user management, data cleanup, or security recovery',
    ],
  },
  'Intake Member': {
    scope: 'Assigned school',
    summary: 'Front-desk intake only — register new students and print their label on the spot.',
    permissions: [
      'Access the Student Intake form only (no dashboard or admin pages)',
      'Limited to the intake sessions selected below',
      'Automatically checks the database for existing records before registering',
      'Registers new students and generates a printable label immediately',
      'Cannot view, edit, or export any other student records',
    ],
  },
} as const;

type RoleName = keyof typeof ROLE_PERMISSION_PREVIEW;

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [configuredSchools, setConfiguredSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [securityUser, setSecurityUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Data Member',
    school: '',
    allowedIntakeSessions: [] as string[],
  });
  const [securityPassword, setSecurityPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSecurityPassword, setShowSecurityPassword] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin');
      return;
    }

    if (session.user.role !== 'Admin' && session.user.role !== 'Data Lead') {
      router.push('/');
      return;
    }

    if (status !== 'authenticated') return;
    fetchUsers();
    fetchSchoolOptions();
  }, [session, status, router]);

  const fetchUsers = async () => {
    if (status !== 'authenticated') return;
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchoolOptions = async () => {
    try {
      const res = await fetch('/api/admin/schools');
      if (!res.ok) return;
      const data = await res.json();
      setConfiguredSchools(Array.isArray(data) ? data : []);
    } catch (err) {
      // Keep existing user-assigned schools available if config loading fails.
      setConfiguredSchools([]);
    }
  };

  const sessionsForSchool = (schoolName: string): string[] => {
    const school = configuredSchools.find(s => s.name === schoolName);
    if (school?.intakeSessions?.length) return school.intakeSessions;
    return DEFAULT_INTAKE_SESSIONS;
  };

  const allSessionsSelected = Boolean(
    form.role === 'Intake Member' &&
    form.school &&
    form.allowedIntakeSessions.length === sessionsForSchool(form.school).length,
  );

  const toggleIntakeSession = (sessionName: string, checked: boolean) => {
    setForm(prev => ({
      ...prev,
      allowedIntakeSessions: checked
        ? [...new Set([...prev.allowedIntakeSessions, sessionName])]
        : prev.allowedIntakeSessions.filter(s => s !== sessionName),
    }));
  };

  const selectAllIntakeSessions = () => {
    if (!form.school) return;
    setForm(prev => ({ ...prev, allowedIntakeSessions: sessionsForSchool(form.school) }));
  };

  const clearAllIntakeSessions = () => {
    setForm(prev => ({ ...prev, allowedIntakeSessions: [] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (form.role === 'Intake Member') {
      if (!form.allowedIntakeSessions.length) {
        setError('Select at least one intake session for Intake Members.');
        setLoading(false);
        return;
      }
    }

    try {
      const url = editingUser ? `/api/users/${editingUser._id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';

      const payload = {
        ...form,
        allowedIntakeSessions:
          form.role === 'Intake Member' ? form.allowedIntakeSessions : [],
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save user');
      }
      
      await fetchUsers();
      setIsModalOpen(false);
      setForm({ name: '', email: '', password: '', role: 'Data Member', school: '', allowedIntakeSessions: [] });
      setEditingUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete user');
      await fetchUsers();
    } catch (err) {
      setError('Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  const handleSecurityAction = async (action: string) => {
    if (!securityUser) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/users/${securityUser._id}/security`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, password: securityPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user security');
      }

      await fetchUsers();
      setSecurityUser(current => {
        if (!current) return current;
        if (action === 'reset-password' || action === 'force-password-change') {
          return { ...current, forcePasswordChange: true };
        }
        if (action === 'clear-force-password-change') {
          return { ...current, forcePasswordChange: false };
        }
        if (action === 'disable-mfa') {
          return { ...current, mfaEnabled: false };
        }
        return current;
      });
      if (action === 'reset-password') {
        setSecurityPassword('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user security');
    } finally {
      setLoading(false);
    }
  };

  const getRoleVariant = (role: string) => {
    switch (role) {
      case 'Admin': return 'destructive';
      case 'Data Lead': return 'default';
      case 'Data Member': return 'secondary';
      case 'Intake Member': return 'outline';
      default: return 'outline';
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setForm({ name: '', email: '', password: '', role: 'Data Member', school: '', allowedIntakeSessions: [] });
    setEditingUser(null);
    setShowPassword(false);
  };

  const handleCloseSecurityModal = () => {
    setSecurityModalOpen(false);
    setSecurityUser(null);
    setSecurityPassword('');
    setShowSecurityPassword(false);
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.school && user.school.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const schoolOptions = Array.from(new Set([
    ...configuredSchools.filter(school => school.active).map(school => school.name),
    ...users.map(user => user.school).filter((school): school is string => Boolean(school)),
  ])).sort();
  const selectedRolePreview = ROLE_PERMISSION_PREVIEW[form.role as RoleName] ?? ROLE_PERMISSION_PREVIEW['Data Member'];

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  return (
    <div className="w-full p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Button variant="ghost" size="sm" className="mb-4" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage system users and their permissions</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/admin/users/migrate">
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Migrate Users
            </Link>
          </Button>
          <Button onClick={() => {
            setEditingUser(null);
            setForm({
              name: '',
              email: '',
              password: '',
              role: 'Data Member',
              school: '',
              allowedIntakeSessions: [],
            });
            setIsModalOpen(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'} found
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>

          {loading && users.length === 0 ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <UsersIcon className="h-8 w-8" />
                        <p>No users found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user._id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleVariant(user.role) as any}>
                          <Shield className="mr-1 h-3 w-3" />
                          {user.role}
                        </Badge>
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {user.mfaEnabled && (
                            <Badge variant="outline" className="text-xs">MFA</Badge>
                          )}
                          {user.forcePasswordChange && (
                            <Badge variant="destructive" className="text-xs">Must change password</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div>{user.school || '-'}</div>
                        {user.role === 'Intake Member' && (
                          <div className="text-[10px] mt-0.5">
                            {user.allowedIntakeSessions?.length
                              ? `${user.allowedIntakeSessions.length} intake session${user.allowedIntakeSessions.length === 1 ? '' : 's'}`
                              : 'All intake sessions'}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(user.lastLogin)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSecurityUser(user);
                              setSecurityModalOpen(true);
                            }}
                            title="Security recovery"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingUser(user);
                              const schoolSessions = sessionsForSchool(user.school || '');
                              setForm({
                                name: user.name,
                                email: user.email,
                                password: '',
                                role: user.role,
                                school: user.school || '',
                                allowedIntakeSessions:
                                  user.role === 'Intake Member'
                                    ? (user.allowedIntakeSessions?.length
                                        ? user.allowedIntakeSessions.filter(s => schoolSessions.includes(s))
                                        : schoolSessions)
                                    : [],
                              });
                              setIsModalOpen(true);
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(user._id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={(open) => {
        if (!open) {
          handleCloseModal();
        } else {
          setIsModalOpen(true);
        }
      }}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Edit User' : 'Add New User'}
            </DialogTitle>
            <DialogDescription>
              {editingUser 
                ? 'Update user information. Leave password blank to keep the current password.'
                : 'Create a new user account with the specified role and permissions.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter full name"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="user@schools.nyc.gov"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password {!editingUser && <span className="text-destructive">*</span>}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder={editingUser ? "Leave blank to keep current" : "Enter password"}
                  required={!editingUser}
                  disabled={loading}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {editingUser && (
                <p className="text-xs text-muted-foreground">
                  Leave blank to keep current password
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">
                Role <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.role}
                onValueChange={(value) => {
                  setForm(prev => {
                    const sessions = prev.school ? sessionsForSchool(prev.school) : [];
                    return {
                      ...prev,
                      role: value,
                      allowedIntakeSessions: value === 'Intake Member' ? sessions : [],
                    };
                  });
                }}
                disabled={loading}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Intake Member">Intake Member</SelectItem>
                  <SelectItem value="Data Member">Data Member</SelectItem>
                  <SelectItem value="Data Lead">Data Lead</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {form.role} Permissions
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedRolePreview.summary}
                    </p>
                  </div>
                  <Badge variant="outline">{selectedRolePreview.scope}</Badge>
                </div>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {selectedRolePreview.permissions.map((permission) => (
                    <li key={permission} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{permission}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="school">
                School <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.school}
                onValueChange={(value) => {
                  const sessions = sessionsForSchool(value);
                  setForm(prev => ({
                    ...prev,
                    school: value,
                    allowedIntakeSessions:
                      prev.role === 'Intake Member'
                        ? (prev.allowedIntakeSessions.length
                            ? prev.allowedIntakeSessions.filter(s => sessions.includes(s))
                            : sessions)
                        : [],
                  }));
                }}
                disabled={loading}
                required
              >
                <SelectTrigger id="school">
                  <SelectValue placeholder="Select school" />
                </SelectTrigger>
                <SelectContent>
                  {schoolOptions.map((school) => (
                    <SelectItem key={school} value={school}>
                      {school}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.role === 'Intake Member' && (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Label className="text-sm font-medium">Intake Sessions</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Choose which sessions this intake member can register students for.
                      {form.school
                        ? ` Sessions are configured for ${form.school}.`
                        : ' Select a school first.'}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={selectAllIntakeSessions}
                      disabled={loading || !form.school || allSessionsSelected}
                    >
                      All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={clearAllIntakeSessions}
                      disabled={loading || form.allowedIntakeSessions.length === 0}
                    >
                      None
                    </Button>
                  </div>
                </div>

                {!form.school ? (
                  <p className="text-xs text-muted-foreground italic">Select a school to load intake sessions.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {sessionsForSchool(form.school).map(sessionName => {
                      const checked = form.allowedIntakeSessions.includes(sessionName);
                      return (
                        <label
                          key={sessionName}
                          className="flex items-start gap-2 rounded-md border bg-background px-3 py-2 cursor-pointer hover:bg-muted/40"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => toggleIntakeSession(sessionName, v === true)}
                            disabled={loading}
                            className="mt-0.5"
                          />
                          <span className="text-sm leading-snug">{sessionName}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {form.school && form.allowedIntakeSessions.length === 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Select at least one session — the intake form will be empty without access.
                  </p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseModal}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : editingUser ? (
                  'Update User'
                ) : (
                  'Create User'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={securityModalOpen} onOpenChange={(open) => {
        if (!open) {
          handleCloseSecurityModal();
        } else {
          setSecurityModalOpen(true);
        }
      }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              User Security Recovery
            </DialogTitle>
            <DialogDescription>
              Reset passwords, force password changes, or disable MFA for locked-out users.
            </DialogDescription>
          </DialogHeader>

          {securityUser && (
            <div className="space-y-5">
              <div className="rounded-lg border p-4">
                <div className="font-medium">{securityUser.name}</div>
                <div className="text-sm text-muted-foreground">{securityUser.email}</div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Badge variant={getRoleVariant(securityUser.role) as any}>{securityUser.role}</Badge>
                  <Badge variant="secondary">{securityUser.school}</Badge>
                  <Badge variant={securityUser.mfaEnabled ? 'default' : 'outline'}>
                    MFA {securityUser.mfaEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                  {securityUser.forcePasswordChange && (
                    <Badge variant="destructive">Password change required</Badge>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="securityPassword">Temporary Password</Label>
                <div className="relative">
                  <Input
                    id="securityPassword"
                    type={showSecurityPassword ? 'text' : 'password'}
                    value={securityPassword}
                    onChange={(e) => setSecurityPassword(e.target.value)}
                    placeholder="Enter temporary password"
                    className="pr-10"
                    disabled={loading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowSecurityPassword(!showSecurityPassword)}
                    disabled={loading}
                  >
                    {showSecurityPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Resetting a password automatically forces the user to change it after login.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  type="button"
                  onClick={() => handleSecurityAction('reset-password')}
                  disabled={loading || securityPassword.length < 8}
                  className="gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Reset Password
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSecurityAction('force-password-change')}
                  disabled={loading}
                >
                  Force Password Change
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSecurityAction('clear-force-password-change')}
                  disabled={loading || !securityUser.forcePasswordChange}
                >
                  Clear Force Change
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSecurityAction('disable-mfa')}
                  disabled={loading || !securityUser.mfaEnabled}
                  className="gap-2"
                >
                  <ShieldOff className="h-4 w-4" />
                  Disable MFA
                </Button>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleCloseSecurityModal} disabled={loading}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 