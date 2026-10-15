/**
 * License Manager (CPO-053 / CPO-061)
 * Client-side verification and key handling for Copio SDK tiers.
 */
export class LicenseManager {
  constructor(licenseKey = null) {
    this.key = licenseKey;
  }

  setKey(key) {
    this.key = key;
  }

  getKey() {
    return this.key;
  }

  isValid() {
    return Boolean(this.key);
  }

  getTier() {
    if (!this.key) return 'community';
    if (this.key.startsWith('pro_')) return 'pro';
    if (this.key.startsWith('ent_')) return 'enterprise';
    return 'commercial';
  }
}
