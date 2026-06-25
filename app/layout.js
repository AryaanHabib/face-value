import "./globals.css";

export const metadata = {
  title: "Face Value",
  description: "The box score lies. Who's a real shot-maker vs. living on easy looks.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="phone">{children}</div>
      </body>
    </html>
  );
}
