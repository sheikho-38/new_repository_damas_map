import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const qomra = localFont({
  src: [
    {
      path: "../../public/fonts/itfQomraArabic-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/itfQomraArabic-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/itfQomraArabic-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/fonts/itfQomraArabic-Black.woff2",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-qomra",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#064239",
};

export const metadata: Metadata = {
  title: "منصة خريطة محافظة دمشق الموحدة | Damascus Governorate Map Platform",
  description: "المنصة الجغرافية الرسمية لمحافظة دمشق - الخريطة المتجهة، شبكة النقل العام، ونقاط الاهتمام المعتمدة",
  applicationName: "خريطة دمشق",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "خريطة دمشق",
  },
  formatDetection: {
    telephone: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${qomra.variable} h-full w-full antialiased`}
    >
      <body className="h-full w-full overflow-hidden flex flex-col select-none touch-manipulation">
        {children}
      </body>
    </html>
  );
}
