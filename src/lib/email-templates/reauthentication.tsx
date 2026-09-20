import * as React from 'react'

import { Heading, Section, Text } from '@react-email/components'

import {
  BRAND,
  Ma3hadiLayout,
  h1,
  note,
  paragraph,
} from './ma3hadi-layout'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Ma3hadiLayout preview={`رمز التحقق الخاص بك: ${token}`}>
    <Heading style={h1}>رمز التحقق</Heading>
    <Text style={paragraph}>
      استخدم الرمز التالي لإتمام العملية الحسّاسة على حسابك في معهدي:
    </Text>
    <Section
      style={{
        backgroundColor: BRAND.soft,
        border: `2px dashed ${BRAND.tealLight}`,
        borderRadius: '14px',
        padding: '20px',
        textAlign: 'center',
        margin: '0 0 18px',
      }}
    >
      <Text
        style={{
          margin: 0,
          fontSize: '34px',
          fontWeight: 800,
          letterSpacing: '10px',
          color: BRAND.tealDark,
          fontFamily: 'monospace',
        }}
      >
        {token}
      </Text>
    </Section>
    <Text style={note}>
      لا تشارك هذا الرمز مع أي شخص. إذا لم تطلبه، تجاهل هذه الرسالة.
    </Text>
  </Ma3hadiLayout>
)

export default ReauthenticationEmail
