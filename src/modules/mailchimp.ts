import axios from 'axios';

let apiKey = import.meta.env.VITE_MAILCHIMP_API_KEY || '';

export const mailchimpService = {
  setApiKey(key: string) {
    apiKey = key;
  },

  getApiKey(): string {
    if (apiKey) return apiKey;
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('mailchimpApiKey');
      if (stored) {
        apiKey = stored;
        return apiKey;
      }
    }
    return '';
  },

  getApiBase(): string {
    const key = this.getApiKey();
    if (!key) throw new Error('Mailchimp API key not configured');
    const dc = key.split('-')[1];
    if (!dc) throw new Error('Invalid Mailchimp API key');
    return `https://${dc}.api.mailchimp.com/3.0`;
  },

  async request(method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, data?: any) {
    const url = `${this.getApiBase()}${path}`;
    const key = this.getApiKey();
    return axios({
      method,
      url,
      data,
      auth: { username: 'anystring', password: key }
    });
  },

  async getLists() {
    const res = await this.request('get', '/lists');
    return res.data.lists || [];
  },

  async createList(params: any) {
    const res = await this.request('post', '/lists', params);
    return res.data;
  },

  async addMemberToList(listId: string, member: any) {
    const res = await this.request('post', `/lists/${listId}/members`, member);
    return res.data;
  },

  async createCampaign(params: any) {
    const res = await this.request('post', '/campaigns', params);
    return res.data;
  },

  async setCampaignContent(id: string, content: { html: string }) {
    const res = await this.request('put', `/campaigns/${id}/content`, content);
    return res.data;
  },

  async sendCampaign(id: string) {
    await this.request('post', `/campaigns/${id}/actions/send`);
  },

  async exportSubscribers(
    subscribers: { email_address: string; status?: 'subscribed' | 'pending' }[],
    listName = 'Shopopti Contacts'
  ) {
    const lists = await this.getLists();
    let list = lists.find((l: any) => l.name === listName);

    if (!list) {
      list = await this.createList({
        name: listName,
        contact: {
          company: 'Shopopti',
          address1: 'N/A',
          city: 'Paris',
          state: 'IDF',
          zip: '00000',
          country: 'FR'
        },
        permission_reminder: 'You are receiving this email because you signed up on Shopopti+',
        campaign_defaults: {
          from_name: 'Shopopti',
          from_email: 'noreply@shopopti.com',
          subject: '',
          language: 'en'
        },
        email_type_option: false
      });
    }

    for (const sub of subscribers) {
      await this.addMemberToList(list.id, {
        email_address: sub.email_address,
        status: sub.status || 'subscribed'
      });
    }
  }
};

export default mailchimpService;
