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
} from './ma3hadi-layout'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Ma3hadiLayout preview="إعادة تعيين كلمة المرور لحسابك في معهدي">
    <Heading style={h1}>إعادة تعيين كلمة المرور</Heading>
    <Text style={paragraph}>
      وصلنا طلب لإعادة تعيين كلمة المرور لحسابك في <strong>{siteName}</strong>.
      اضغط الزر أدناه لاختيار كلمة مرور جديدة.
    </Text>
    <Section style={buttonWrap}>
      <Button className="mh-btn" style={button} href={confirmationUrl}>
        تعيين كلمة مرور جديدة
      </Button>
    </Section>
    <Section
      style={{
        backgroundColor: BRAND.soft,
        border: '1px solid #99F6E4',
        borderRadius: '12px',
        padding: '12px 16px',
        margin: '0 0 16px',
      }}
    >
      <Text
        style={{
          margin: 0,
          fontSize: '13px',
          color: BRAND.tealDark,
          lineHeight: '1.8',
        }}
      >
        🔒 لحمايتك: بعد تغيير كلمة المرور سيتم إنهاء جميع الجلسات القديمة على
        كل أجهزتك تلقائياً.
      </Text>
    </Section>
    <Text style={note}>
      إذا لم تطلب إعادة التعيين، تجاهل هذه الرسالة — لن تتغيّر كلمة مرورك.
    </Text>
  </Ma3hadiLayout>
)

export default RecoveryEmail
