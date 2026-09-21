export interface NotifPrefs {
  weeklySummary: boolean
  filterAlerts: boolean
  milestones: boolean
  marketing: boolean
}

export const DEFAULT_NOTIF: NotifPrefs = {
  weeklySummary: true,
  filterAlerts: true,
  milestones: true,
  marketing: false,
}
