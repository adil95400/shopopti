import mailchimp from '@mailchimp/mailchimp_marketing';

import { supabase } from '../lib/supabase';

let apiKey = import.meta.env.VITE_MAILCHIMP_API_KEY || '';
let serverPrefix = import.meta.env.VITE_MAILCHIMP_SERVER_PREFIX || '';

export const configureMailchimp = (key: string, server: string) => {
  apiKey = key;
  serverPrefix = server;
  if (typeof window !== 'undefined') {
    localStorage.setItem('mailchimpApiKey', key);
    localStorage.setItem('mailchimpServerPrefix', server);
  }
  mailchimp.setConfig({ apiKey: key, server });
};

const ensureConfig = () => {
  if (!apiKey || !serverPrefix) {
    if (typeof window !== 'undefined') {
      apiKey = apiKey || localStorage.getItem('mailchimpApiKey') || '';
      serverPrefix = serverPrefix || localStorage.getItem('mailchimpServerPrefix') || '';
    }
    if (!apiKey || !serverPrefix) {
      throw new Error('Mailchimp API credentials not configured');
    }
  }
  mailchimp.setConfig({ apiKey, server: serverPrefix });
};

export const mailchimpService = {
  async getLists() {
    ensureConfig();
    const data = await mailchimp.lists.getAllLists();
    return data.lists;
  },

  async addSubscribers(listId: string, members: { email: string; merge_fields?: Record<string, any> }[]) {
    ensureConfig();
    await mailchimp.lists.batchListMembers(listId, {
      members: members.map(m => ({
        email_address: m.email,
        status: 'subscribed',
        merge_fields: m.merge_fields || {}
      })),
      update_existing: true
    });
  },

  async createCampaign(options: {
    listId: string;
    subject: string;
    fromName: string;
    replyTo: string;
    html: string;
  }) {
    ensureConfig();
    const campaign = await mailchimp.campaigns.create({
      type: 'regular',
      recipients: { list_id: options.listId },
      settings: {
        subject_line: options.subject,
        from_name: options.fromName,
        reply_to: options.replyTo
      }
    });
    await mailchimp.campaigns.setContent(campaign.id, { html: options.html });
    return campaign;
  },

  async sendCampaign(campaignId: string) {
    ensureConfig();
    await mailchimp.campaigns.send(campaignId);
  },

  async exportOrderEmails(listId: string) {
    ensureConfig();
    const { data, error } = await supabase.from('orders').select('customer_email');
    if (error) throw error;
    const emails = Array.from(new Set((data || []).map((d: any) => d.customer_email).filter(Boolean)));
    if (emails.length) {
      await this.addSubscribers(listId, emails.map(email => ({ email })));
    }
    return emails.length;
  }
};
