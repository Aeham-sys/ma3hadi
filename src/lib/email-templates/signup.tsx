import * as React from 'react'

import { Button, Heading, Link, Section, Text } from '@react-email/components'

import {
  Ma3hadiLayout,
  button,
  buttonWrap,
  h1,
  muted,
  note,
  paragraph,
  pill,
} from './ma3hadi-layout'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Ma3hadiLayout preview={`أهلاً بك في معهدي — أكّد بريدك الإلكتروني لتفعيل حسابك`}>
    <Heading style={h1}>أهلاً بك في معهدي</Heading>
    <Text style={paragraph}>
      شكراً لتسجيلك في <strong>معهدي</strong>، نظام إدارة معهدك التعليمي — الطلاب
      والمدرسون والمواد والدفعات، كلها في مكان واحد.
    </Text>
    <Text style={paragraph}>بقي خطوة واحدة: أكّد بريدك الإلكتروني</Text>
    <Section style={{ textAlign: 'center', margin: '0 0 20px' }}>
      <span style={pill}>{recipient}</span>
    </Section>
    <Section style={buttonWrap}>
      <Button className="mh-btn" style={button} href={confirmationUrl}>
        تأكيد البريد الإلكتروني
      </Button>
    </Section>
    <Text style={muted}>
      بعد التأكيد ستتمكّن من إنشاء معهدك والبدء بفترة التجربة المجانية فوراً من{' '}
      <Link href={siteUrl} style={{ color: '#0D9488' }}>
        {siteName}
      </Link>
      .
    </Text>
    <Text style={note}>
      إذا لم تقم بإنشاء هذا الحساب، يمكنك تجاهل هذه الرسالة بأمان.
    </Text>
  </Ma3hadiLayout>
)

export default SignupEmail
