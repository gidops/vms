import { NotificationChannel } from '@prisma/client';
import { I18nService } from '../../../shared/i18n/i18n.service';
import { NOTIFICATION_TEMPLATES } from '../notification.types';
import { QrService } from '../qr/qr.service';
import { TemplateService } from './template.service';

describe('TemplateService', () => {
  const service = new TemplateService(new I18nService(), new QrService());
  const data = {
    visitorName: 'Paebi Bobson',
    host: 'Sarah Lee',
    visitDate: '15-06-2026',
    time: '00:00',
    purpose: 'Official',
    code: '4486-BC9C',
  };

  it('renders a localized email with subject, HTML and an inline QR attachment', async () => {
    const msg = await service.render(
      NOTIFICATION_TEMPLATES.VISIT_APPROVED,
      NotificationChannel.EMAIL,
      'EN',
      data,
    );
    expect(msg.subject).toBe('Your Visit has been Confirmed!');
    expect(msg.html).toContain('Paebi Bobson');
    expect(msg.html).toContain('4486-BC9C');
    expect(msg.html).toContain('cid:qr');
    expect(msg.attachments).toHaveLength(1);
    expect(msg.attachments?.[0].cid).toBe('qr');
  });

  it('renders the email subject in French', async () => {
    const msg = await service.render(
      NOTIFICATION_TEMPLATES.VISIT_APPROVED,
      NotificationChannel.EMAIL,
      'FR',
      data,
    );
    expect(msg.subject).toBe('Votre visite a été confirmée !');
  });

  it('renders SMS text from the catalog with interpolation', async () => {
    const msg = await service.render(
      NOTIFICATION_TEMPLATES.VISIT_APPROVED,
      NotificationChannel.SMS,
      'EN',
      data,
    );
    expect(msg.text).toContain('4486-BC9C');
    expect(msg.text).toContain('Paebi Bobson');
    expect(msg.html).toBeUndefined();
  });

  it('renders in-app title and body', async () => {
    const msg = await service.render(
      NOTIFICATION_TEMPLATES.VISITOR_ARRIVED,
      NotificationChannel.IN_APP,
      'EN',
      { visitorName: 'Paebi Bobson' },
    );
    expect(msg.subject).toBe('Guest arrived');
    expect(msg.text).toContain('Paebi Bobson');
  });
});
