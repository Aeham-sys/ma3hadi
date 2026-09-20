import * as React from 'react'

import { Button, Heading, Section, Text } from '@react-email/components'

import {
  Ma3hadiLayout,
  button,
  buttonWrap,
  h1,
  note,
  paragraph,
} from './ma3hadi-layout'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Ma3hadiLayout preview={`رابط تسجيل الدخول إلى ${siteName}`}>
    <Heading style={h1}>رابط تسجيل الدخول</Heading>
    <Text style={paragraph}>
      اضغط الزر أدناه لتسجيل الدخول إلى حسابك في <strong>{siteName}</strong>{' '}
      مباشرة — دون الحاجة لكلمة مرور.
    </Text>
    <Section style={buttonWrap}>
      <Button className="mh-btn" style={button} href={confirmationUrl}>
        تسجيل الدخول
      </Button>
    </Section>
    <Text style={note}>
      هذا الرابط صالح لمرة واحدة فقط. إذا لم تطلب تسجيل الدخول، تجاهل الرسالة.
    </Text>
  </Ma3hadiLayout>
)

export default MagicLinkEmail
