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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Ma3hadiLayout preview={`تمت دعوتك للانضمام إلى ${siteName}`}>
    <Heading style={h1}>تمت دعوتك للانضمام</Heading>
    <Text style={paragraph}>
      تلقّيت دعوة للانضمام إلى <strong>{siteName}</strong> — نظام إدارة المعاهد
      التعليمية. اضغط الزر أدناه لقبول الدعوة وإنشاء حسابك.
    </Text>
    <Section style={buttonWrap}>
      <Button className="mh-btn" style={button} href={confirmationUrl}>
        قبول الدعوة
      </Button>
    </Section>
    <Text style={note}>
      إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذه الرسالة بأمان.
    </Text>
  </Ma3hadiLayout>
)

export default InviteEmail
