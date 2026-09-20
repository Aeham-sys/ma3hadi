import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "معهدي — إدارة معهدك بمكان واحد" },
      {
        name: "description",
        content:
          "تابع دفعات الطلاب، ادفع للمدرسين، ونظّم برنامج الدوام — بدون واتساب ولا دفاتر ولا إكسل.",
      },
      { property: "og:title", content: "معهدي — إدارة معهدك بمكان واحد" },
      {
        property: "og:description",
        content: "نظام عربي بسيط لإدارة الطلاب والمدرسين والمواد والدفعات في معهدك.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      navigate({ to: data.session ? "/dashboard" : "/auth", replace: true });
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 size-12 animate-pulse rounded-2xl bg-primary" />
        <h1 className="text-lg font-bold text-foreground">
          معهدي — نظام إدارة المعاهد التعليمية
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          نظام عربي بسيط لإدارة الطلاب والمدرسين والمواد، متابعة الدفعات والمستحقات، وتنظيم برنامج
          الدوام في معهدك من مكان واحد.
        </p>
      </div>
    </div>
  );
}
