import { useEffect, useState, type ReactNode } from "react";
import { Download, X, Smartphone, Monitor, Share, Plus } from "lucide-react";
import { usePrefs } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function detectPlatform(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (/iphone|ipad|ipod/.test(ua) && !isStandalone) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** Always-visible install button. Triggers the native install prompt when the
 *  browser offers one; otherwise opens a dialog with platform instructions. */
export function InstallAppButton() {
  const { t } = usePrefs();
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">(
    "desktop",
  );
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  // Hide once running as an installed app.
  if (installed) return null;

  const onClick = async () => {
    if (promptEvent) {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setPromptEvent(null);
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label={t("ثبّت التطبيق على جهازك", "Install the app on your device")}
        className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20 active:scale-95"
      >
        <Download className="size-3.5" />
        <span className="hidden xs:inline sm:inline">{t("ثبّت التطبيق", "Install app")}</span>
      </button>

      <InstallDialog open={open} onOpenChange={setOpen} platform={platform} />
    </>
  );
}

function InstallDialog({
  open,
  onOpenChange,
  platform,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  platform: "ios" | "android" | "desktop";
}) {
  const { t } = usePrefs();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl p-6 text-center">
        <DialogHeader className="text-center">
          <DialogTitle className="flex flex-col items-center gap-2 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Download className="size-6" />
            </span>
            {t("ثبّت تطبيق معهدي", "Install معهدي app")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("تعليمات تثبيت التطبيق", "App install instructions")}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-3 text-start">
          {platform === "ios" ? (
            <Steps
              icon={Smartphone}
              title={t("على آيفون / آيباد", "On iPhone / iPad")}
            >
              <Step>
                {t(
                  "اضغط زر المشاركة في سفاري",
                  "Tap the Share button in Safari",
                )}
                <Share className="inline size-4 align-text-bottom text-primary" />
              </Step>
              <Step>
                {t(
                  "اختر «إضافة إلى الشاشة الرئيسية»",
                  'Choose "Add to Home Screen"',
                )}
                <Plus className="inline size-4 align-text-bottom text-primary" />
              </Step>
              <Step>{t("اضغط «إضافة»", 'Tap "Add"')}</Step>
            </Steps>
          ) : platform === "android" ? (
            <Steps icon={Smartphone} title={t("على أندرويد", "On Android")}>
              <Step>
                {t(
                  "افتح قائمة المتصفح (ثلاث نقاط)",
                  "Open the browser menu (three dots)",
                )}
              </Step>
              <Step>
                {t(
                  'اختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية"',
                  'Choose "Install app" or "Add to Home screen"',
                )}
              </Step>
            </Steps>
          ) : (
            <Steps icon={Monitor} title={t("على الكمبيوتر", "On desktop")}>
              <Step>
                {t(
                  "اضغط أيقونة التثبيت في شريط العنوان",
                  "Click the install icon in the address bar",
                )}
              </Step>
              <Step>
                {t(
                  "أو من قائمة المتصفح اختر «تثبيت التطبيق»",
                  'Or from the browser menu choose "Install app"',
                )}
              </Step>
            </Steps>
          )}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          {t(
            "التطبيق يشتغل بدون متصفح وبفتح بسرعة عالجهاز.",
            "The app runs without a browser and opens quickly on your device.",
          )}
        </p>

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mx-auto mt-4 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"
        >
          <X className="size-3.5" />
          {t("إغلاق", "Close")}
        </button>
      </DialogContent>
    </Dialog>
  );
}

function Steps({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Smartphone;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-muted/50 p-4">
      <p className="mb-2 flex items-center gap-2 text-xs font-bold text-foreground">
        <Icon className="size-4 text-primary" />
        {title}
      </p>
      <ol className="space-y-2 ps-5 text-sm leading-relaxed text-foreground">
        {children}
      </ol>
    </div>
  );
}

function Step({ children }: { children: ReactNode }) {
  return (
    <li className="list-decimal marker:font-bold marker:text-primary">
      {children}
    </li>
  );
}
