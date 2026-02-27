/**
 * Notification Types and Templates
 * Defines all notification types and their email templates
 */

// Notification type enum matching PRD Table: Notification Types & Templates
export type NotificationType =
  // Auth notifications (transactional - cannot be disabled)
  | 'email_verification'
  | 'password_reset'
  | 'email_change_request'
  | 'email_change_complete'
  // Draft notifications
  | 'draft_window_open'
  | 'draft_window_closing'
  | 'draft_your_turn'
  | 'draft_pick_expired'
  | 'draft_completed'
  | 'driver_substitution'
  // League notifications
  | 'league_invite'
  | 'join_request_received'
  | 'join_request_approved'
  | 'removed_from_league'
  // Results notifications
  | 'weekly_winner'
  | 'season_podium'
  // Admin notifications
  | 'data_discrepancy'
  | 'commissioner_flag';

// Notification types that are transactional (cannot be disabled)
export const TRANSACTIONAL_NOTIFICATION_TYPES: Set<NotificationType> = new Set([
  'email_verification',
  'password_reset',
  'email_change_request',
  'email_change_complete',
]);

// Email template data for each notification type
export interface EmailTemplateData {
  subject: string;
  title: string;
  bodyTemplate: string;
  actionUrl?: string;
  actionText?: string;
}

// Template variables that can be interpolated
export interface TemplateVariables {
  // User info
  username?: string;
  displayName?: string;
  teamName?: string;
  // League info
  leagueName?: string;
  leagueId?: string;
  // Race info
  raceName?: string;
  raceRound?: string;
  // Draft info
  draftPosition?: string;
  timeRemaining?: string;
  driverName?: string;
  // Other
  url?: string;
  token?: string;
  [key: string]: string | undefined;
}

// Email templates for each notification type
export const EMAIL_TEMPLATES: Record<NotificationType, EmailTemplateData> = {
  // Auth notifications
  email_verification: {
    subject: 'Verify your PitLane account',
    title: 'Welcome to PitLane!',
    bodyTemplate: `
      <p>Hello {{username}},</p>
      <p>Thank you for registering at PitLane! Please verify your email address to activate your account.</p>
      <p>This link will expire in 24 hours.</p>
    `,
    actionUrl: '{{url}}',
    actionText: 'Verify Email',
  },
  password_reset: {
    subject: 'Reset your PitLane password',
    title: 'Password Reset Request',
    bodyTemplate: `
      <p>Hello {{username}},</p>
      <p>We received a request to reset your password. Click the button below to create a new password.</p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
    actionUrl: '{{url}}',
    actionText: 'Reset Password',
  },
  email_change_request: {
    subject: 'Confirm your email change',
    title: 'Email Change Request',
    bodyTemplate: `
      <p>Hello {{username}},</p>
      <p>You requested to change your email to <strong>{{newEmail}}</strong>.</p>
      <p>Please confirm this change by clicking the button below.</p>
      <p>For security, this change will have a 24-hour hold period unless you waive it.</p>
      <p>If you didn't request this change, you can cancel it from your profile settings.</p>
    `,
    actionUrl: '{{url}}',
    actionText: 'Confirm Email Change',
  },
  email_change_complete: {
    subject: 'Your email has been changed',
    title: 'Email Change Complete',
    bodyTemplate: `
      <p>Hello {{username}},</p>
      <p>Your email has been successfully changed to <strong>{{newEmail}}</strong>.</p>
      <p>For security purposes, you have been logged out of all devices. Please log in again with your new email.</p>
    `,
  },

  // Draft notifications
  draft_window_open: {
    subject: 'Draft window open for {{raceName}}!',
    title: 'Draft Window Open',
    bodyTemplate: `
      <p>Hello {{username}},</p>
      <p>The draft window for <strong>{{raceName}}</strong> is now open in your league <strong>{{leagueName}}</strong>!</p>
      <p>Log in now to make your driver picks before the window closes.</p>
    `,
    actionUrl: '{{url}}',
    actionText: 'Go to Draft',
  },
  draft_window_closing: {
    subject: 'Draft closes in 24 hours - {{raceName}}',
    title: 'Draft Window Closing Soon',
    bodyTemplate: `
      <p>Hello {{username}},</p>
      <p>The draft window for <strong>{{raceName}}</strong> closes in 24 hours!</p>
      <p>{{incompleteMessage}}</p>
    `,
    actionUrl: '{{url}}',
    actionText: 'Complete Your Picks',
  },
  draft_your_turn: {
    subject: "It's your turn to pick! - {{leagueName}}",
    title: 'Your Turn to Draft',
    bodyTemplate: `
      <p>Hello {{username}},</p>
      <p>It's your turn to make a pick in <strong>{{leagueName}}</strong>!</p>
      <p>Race: <strong>{{raceName}}</strong></p>
      <p>Round {{round}}, Pick {{pickNumber}}</p>
      <p>You have 24 hours to make your selection.</p>
    `,
    actionUrl: '{{url}}',
    actionText: 'Make Your Pick',
  },
  draft_pick_expired: {
    subject: 'Your pick has expired - {{leagueName}}',
    title: 'Pick Expired',
    bodyTemplate: `
      <p>Hello {{username}},</p>
      <p>Your 24-hour pick window has expired in <strong>{{leagueName}}</strong>.</p>
      <p>A driver has been automatically assigned to you based on your league's settings.</p>
      <p>Assigned driver: <strong>{{driverName}}</strong></p>
    `,
    actionUrl: '{{url}}',
    actionText: 'View Your Team',
  },
  draft_completed: {
    subject: 'Draft complete for {{raceName}}!',
    title: 'Draft Complete',
    bodyTemplate: `
      <p>Hello {{username}},</p>
      <p>The draft for <strong>{{raceName}}</strong> in <strong>{{leagueName}}</strong> is now complete!</p>
      <p>Good luck this race weekend!</p>
    `,
    actionUrl: '{{url}}',
    actionText: 'View Standings',
  },
  driver_substitution: {
    subject: 'Driver substitution alert - {{leagueName}}',
    title: 'Driver Substitution',
    bodyTemplate: `
      <p>Hello {{username}},</p>
      <p>There has been a driver substitution affecting your team in <strong>{{leagueName}}</strong>.</p>
      <p>{{substitutionDetails}}</p>
      <p>{{actionMessage}}</p>
    `,
    actionUrl: '{{url}}',
    actionText: 'View Details',
  },

  // League notifications
  league_invite: {
    subject: "You've been invited to join {{leagueName}}",
    title: 'League Invitation',
    bodyTemplate: `
      <p>Hello {{username}},</p>
      <p>You've been invited to join the fantasy league <strong>{{leagueName}}</strong>!</p>
      <p>This invitation will expire in 7 days.</p>
    `,
    actionUrl: '{{url}}',
    actionText: 'Join League',
  },
  join_request_received: {
    subject: 'New join request for {{leagueName}}',
    title: 'New Join Request',
    bodyTemplate: `
      <p>Hello {{username}},</p>
      <p><strong>{{requesterName}}</strong> has requested to join your league <strong>{{leagueName}}</strong>.</p>
      <p>Review and approve or deny their request from your league settings.</p>
    `,
    actionUrl: '{{url}}',
    actionText: 'Review Request',
  },
  join_request_approved: {
    subject: "You've been approved to join {{leagueName}}!",
    title: 'Join Request Approved',
    bodyTemplate: `
      <p>Hello {{username}},</p>
      <p>Your request to join <strong>{{leagueName}}</strong> has been approved!</p>
      <p>You can now participate in drafts and compete for the season podium.</p>
    `,
    actionUrl: '{{url}}',
    actionText: 'Go to League',
  },
  removed_from_league: {
    subject: 'You have been removed from {{leagueName}}',
    title: 'Removed from League',
    bodyTemplate: `
      <p>Hello {{username}},</p>
      <p>You have been removed from the league <strong>{{leagueName}}</strong>.</p>
      <p>If you believe this was an error, please contact the league commissioner.</p>
    `,
  },

  // Results notifications
  weekly_winner: {
    subject: 'Congratulations! You won week {{raceName}}!',
    title: 'Weekly Winner! 🏆',
    bodyTemplate: `
      <p>Congratulations, {{username}}!</p>
      <p>You had the highest score in <strong>{{leagueName}}</strong> for the <strong>{{raceName}}</strong>!</p>
      <p>Your score: <strong>{{score}} points</strong></p>
      <p>Keep up the great work!</p>
    `,
    actionUrl: '{{url}}',
    actionText: 'View Results',
  },
  season_podium: {
    subject: 'Season Podium - You finished {{position}}!',
    title: 'Season Podium Finish! 🏆',
    bodyTemplate: `
      <p>Congratulations, {{username}}!</p>
      <p>You finished the season in <strong>{{position}} place</strong> in <strong>{{leagueName}}</strong>!</p>
      <p>Final standings:</p>
      <p>{{standingsSummary}}</p>
    `,
    actionUrl: '{{url}}',
    actionText: 'View Final Standings',
  },

  // Admin notifications
  data_discrepancy: {
    subject: 'Data discrepancy detected for {{raceName}}',
    title: 'Data Discrepancy Alert',
    bodyTemplate: `
      <p>A data discrepancy has been detected for <strong>{{raceName}}</strong>.</p>
      <p>{{discrepancyDetails}}</p>
      <p>Please review and resolve this in the admin panel.</p>
    `,
    actionUrl: '{{url}}',
    actionText: 'Review in Admin Panel',
  },
  commissioner_flag: {
    subject: 'New issue flagged in {{leagueName}}',
    title: 'Commissioner Flag Received',
    bodyTemplate: `
      <p>A commissioner has flagged an issue in <strong>{{leagueName}}</strong>.</p>
      <p><strong>Issue:</strong> {{issueDescription}}</p>
      <p>Please review and take appropriate action.</p>
    `,
    actionUrl: '{{url}}',
    actionText: 'Review Flag',
  },
};

/**
 * Interpolate template variables into a string
 */
export function interpolateTemplate(template: string, variables: TemplateVariables): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
  }
  return result;
}

/**
 * Generate email HTML from template and variables
 */
export function generateEmailHtml(
  template: EmailTemplateData,
  variables: TemplateVariables,
  baseUrl: string
): string {
  const interpolatedBody = interpolateTemplate(template.bodyTemplate, variables);
  const actionUrl = template.actionUrl ? interpolateTemplate(template.actionUrl, variables) : undefined;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${template.title}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #e10600 0%, #ff3b30 100%); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">PitLane</h1>
      </div>
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="color: #e10600; margin-top: 0;">${template.title}</h2>
        ${interpolatedBody}
        ${actionUrl && template.actionText ? `
          <div style="margin: 30px 0; text-align: center;">
            <a href="${actionUrl}" style="background: #e10600; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">${template.actionText}</a>
          </div>
        ` : ''}
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
        <p style="font-size: 12px; color: #666; text-align: center;">
          © ${new Date().getFullYear()} PitLane. All rights reserved.<br>
          <a href="${baseUrl}/settings/notifications" style="color: #666;">Manage notification preferences</a>
        </p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate plain text email from template and variables
 */
export function generateEmailText(
  template: EmailTemplateData,
  variables: TemplateVariables
): string {
  const interpolatedBody = interpolateTemplate(template.bodyTemplate, variables);
  const actionUrl = template.actionUrl ? interpolateTemplate(template.actionUrl, variables) : undefined;
  
  // Strip HTML tags for plain text
  const plainBody = interpolatedBody.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  
  let text = `${template.title}\n\n${plainBody}\n`;
  
  if (actionUrl && template.actionText) {
    text += `\n${template.actionText}: ${actionUrl}\n`;
  }
  
  text += `\n---\n© ${new Date().getFullYear()} PitLane. All rights reserved.`;
  
  return text;
}

/**
 * Check if a notification type is transactional (cannot be disabled)
 */
export function isTransactional(type: NotificationType): boolean {
  return TRANSACTIONAL_NOTIFICATION_TYPES.has(type);
}