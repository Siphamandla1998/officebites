// Public, exact staging origins for this verified checkout repair. These are
// appended only in the staging project; production keeps its configured list.
// A new preview URL must be reviewed explicitly rather than using *.vercel.app.
export function stagingPaymentOrigins(projectUrl: string | undefined): string[] {
  try {
    const url = new URL(projectUrl || '');
    if (url.protocol !== 'https:' || url.username || url.password ||
        url.hostname !== 'eyhmarmekioovcjibcbr.supabase.co') return [];
    return [
      'https://officebites-n7cs82zjg-sp24tg-6983s-projects.vercel.app',
      'http://127.0.0.1:5173',
    ];
  } catch { return []; }
}
