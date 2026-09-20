import * as React from 'react'

import {
  Body,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components'

export const BRAND = {
  name: 'معهدي',
  tagline: 'نظام إدارة المعاهد التعليمية',
  teal: '#0D9488',
  tealDark: '#0F766E',
  tealLight: '#14B8A6',
  ink: '#0F172A',
  body: '#334155',
  muted: '#64748B',
  faint: '#94A3B8',
  line: '#E2E8F0',
  soft: '#F0FDFA',
  site: 'ayhamdev.me',
}

export const fontStack = "'Cairo','Segoe UI',Tahoma,Arial,sans-serif"

// Keep free of >, &, and quotes: React may HTML-escape style text children.
const animations = `
  @keyframes mhRise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes mhPop { 0% { opacity: 0; transform: scale(0.85); } 70% { transform: scale(1.04); } 100% { opacity: 1; transform: scale(1); } }
  .mh-logo { animation: mhPop 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .mh-card { animation: mhRise 0.55s ease-out both; }
  .mh-late { animation: mhRise 0.55s ease-out 0.15s both; }
  .mh-btn { transition: background-color 0.2s ease; }
  .mh-btn:hover { background-color: #0F766E !important; }
`

interface LayoutProps {
  preview: string
  children: React.ReactNode
}

export const Ma3hadiLayout = ({ preview, children }: LayoutProps) => (
  <Html lang="ar" dir="rtl">
    <Head>
      <link
        href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap"
        rel="stylesheet"
      />
      <style>{animations}</style>
    </Head>
    <Preview>{preview}</Preview>
    <Body style={main}>
      <Container style={outer}>
        <Container className="mh-card" style={card}>
          <Row>
            <Column style={topBar} />
          </Row>

          <Section style={header}>
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
              <tbody>
                <tr>
                  <td style={{ width: '64px', verticalAlign: 'middle' }}>
                    <div className="mh-logo" style={logoMark}>
                      م
                    </div>
                  </td>
                  <td style={{ verticalAlign: 'middle' }}>
                    <Text style={wordmark}>{BRAND.name}</Text>
                    <Text style={tagline}>{BRAND.tagline}</Text>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section className="mh-late" style={content}>
            {children}
          </Section>

          <Hr style={hr} />
          <Section style={footerSection}>
            <Text style={footerText}>
              هذه الرسالة أُرسلت من {BRAND.name} — {BRAND.tagline}
            </Text>
            <Text style={footerText}>
              <Link href={`https://${BRAND.site}`} style={footerLink}>
                {BRAND.site}
              </Link>
            </Text>
          </Section>
        </Container>

        <Text style={belowCard}>© 2026 {BRAND.name} · جميع الحقوق محفوظة</Text>
      </Container>
    </Body>
  </Html>
)

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily: fontStack,
}

const outer: React.CSSProperties = {
  padding: '32px 12px',
  backgroundColor: '#F8FAFC',
  backgroundImage:
    'radial-gradient(circle at 15% 0%, #F0FDFA 0%, rgba(240,253,250,0) 45%), radial-gradient(circle at 90% 100%, #ECFEFF 0%, rgba(236,254,255,0) 40%)',
}

const card: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '18px',
  border: `1px solid ${BRAND.line}`,
  boxShadow: '0 12px 32px rgba(13, 148, 136, 0.08)',
  overflow: 'hidden',
  maxWidth: '520px',
  margin: '0 auto',
}

const topBar: React.CSSProperties = {
  height: '6px',
  backgroundImage: `linear-gradient(90deg, ${BRAND.teal} 0%, ${BRAND.tealLight} 55%, #22D3EE 100%)`,
}

const header: React.CSSProperties = {
  padding: '28px 28px 8px',
}

const logoMark: React.CSSProperties = {
  width: '56px',
  height: '56px',
  borderRadius: '16px',
  backgroundImage: `linear-gradient(135deg, ${BRAND.tealLight} 0%, ${BRAND.teal} 60%, ${BRAND.tealDark} 100%)`,
  color: '#ffffff',
  fontSize: '30px',
  fontWeight: 800,
  fontFamily: fontStack,
  textAlign: 'center',
  lineHeight: '56px',
  boxShadow: '0 6px 16px rgba(13, 148, 136, 0.35)',
}

const wordmark: React.CSSProperties = {
  margin: 0,
  fontSize: '24px',
  fontWeight: 800,
  color: BRAND.ink,
  lineHeight: '1.2',
}

const tagline: React.CSSProperties = {
  margin: '2px 0 0',
  fontSize: '12px',
  color: BRAND.muted,
}

const content: React.CSSProperties = {
  padding: '12px 28px 8px',
}

const hr: React.CSSProperties = {
  borderColor: BRAND.line,
  margin: '24px 28px 0',
}

const footerSection: React.CSSProperties = {
  padding: '16px 28px 24px',
}

const footerText: React.CSSProperties = {
  margin: '0 0 4px',
  fontSize: '12px',
  color: BRAND.faint,
  textAlign: 'center',
  lineHeight: '1.6',
}

const footerLink: React.CSSProperties = {
  color: BRAND.teal,
  textDecoration: 'none',
}

const belowCard: React.CSSProperties = {
  margin: '18px 0 0',
  fontSize: '11px',
  color: BRAND.faint,
  textAlign: 'center',
}

export const h1: React.CSSProperties = {
  margin: '4px 0 14px',
  fontSize: '22px',
  fontWeight: 800,
  color: BRAND.ink,
  lineHeight: '1.4',
}

export const paragraph: React.CSSProperties = {
  margin: '0 0 18px',
  fontSize: '14px',
  color: BRAND.body,
  lineHeight: '1.9',
}

export const muted: React.CSSProperties = {
  margin: '0 0 18px',
  fontSize: '13px',
  color: BRAND.muted,
  lineHeight: '1.8',
}

export const button: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: BRAND.teal,
  backgroundImage: `linear-gradient(135deg, ${BRAND.tealLight} 0%, ${BRAND.teal} 70%)`,
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 700,
  borderRadius: '12px',
  padding: '13px 34px',
  textDecoration: 'none',
  boxShadow: '0 6px 16px rgba(13, 148, 136, 0.35)',
}

export const buttonWrap: React.CSSProperties = {
  textAlign: 'center',
  margin: '6px 0 22px',
}

export const note: React.CSSProperties = {
  margin: '18px 0 4px',
  fontSize: '12px',
  color: BRAND.faint,
  lineHeight: '1.8',
  textAlign: 'center',
}

export const pill: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: BRAND.soft,
  border: `1px solid #99F6E4`,
  borderRadius: '999px',
  padding: '4px 14px',
  fontSize: '13px',
  color: BRAND.tealDark,
  fontWeight: 600,
}
