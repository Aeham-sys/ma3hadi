import * as React from 'react'

import { Button, Heading, Section, Text } from '@react-email/components'

import {
  BRAND,
  Ma3hadiLayout,
  button,
  buttonWrap,
  h1,
  note,
  paragraph,
  pill,
} from './ma3hadi-layout'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Ma3hadiLayout preview={`تأكيد بريدك الإلكتروني الجديد في ${siteName}`}>
    <Heading style={h1}>تأكيد البريد الإلكتروني الجديد</Heading>
    <Text style={paragraph}>
      طلبت تغيير بريدك الإلكتروني في <strong>{siteName}</strong> من:
    </Text>
    <Section style={{ textAlign: 'center', margin: '0 0 14px' }}>
      <span
        style={{
          display: 'inline-block',
          backgroundColor: '#F1F5F9',
          borderRadius: '999px',
          padding: '4px 14px',
          fontSize: '13px',
          color: BRAND.muted,
        }}
      >
        {oldEmail}
      </span>
      <Text
        style={{ margin: '8px 0', fontSize: '16px', color: BRAND.teal }}
      >
        ⬇
      </Text>
      <span style={pill}>{newEmail}</span>
    </Section>
    <Text style={paragraph}>اضغط الزر أدناه لتأكيد بريدك الجديد:</Text>
    <Section style={buttonWrap}>
      <Button className="mh-btn" style={button} href={confirmationUrl}>
        تأكيد البريد الجديد
      </Button>
    </Section>
    <Text style={note}>
      إذا لم تطلب هذا التغيير، تجاهل الرسالة وسيبقى بريدك الحالي كما هو.
    </Text>
  </Ma3hadiLayout>
)

export default EmailChangeEmail
