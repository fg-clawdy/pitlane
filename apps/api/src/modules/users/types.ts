export interface UserProfile {  id: string;  email: string;  username: string;  displayName: string | null;  defaultTeamName: string | null;  emailEnabled: boolean;  pushEnabled: boolean;  status: string;  role: string;  createdAt: Date;  updatedAt: Date;}

export interface UpdateProfileDto {  username?: string;  displayName?: string;  defaultTeamName?: string;  emailEnabled?: boolean;  pushEnabled?: boolean;}

export interface ChangePasswordDto {  currentPassword: string;  newPassword: string;}

export interface PushSubscriptionDto {  endpoint: string;  p256dh: string;  auth: string;}