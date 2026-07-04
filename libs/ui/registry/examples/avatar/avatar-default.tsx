import { Avatar } from "@/components/ui/avatar";

export default function AvatarDefault() {
  return (
    <div className="flex items-center gap-4">
      <Avatar
        src="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2064%2064'%3E%3Crect%20width='64'%20height='64'%20rx='14'%20fill='%23111827'/%3E%3Cpath%20fill='%2322d3ee'%20d='M12%2012h16v16H12zM36%2012h16v16H36zM20%2036h24v12H20z'/%3E%3Cpath%20fill='%23f8fafc'%20d='M28%2028h8v8h-8zM12%2052h40v4H12z'/%3E%3C/svg%3E"
        alt="Felix"
        fallback="FX"
      />
      <Avatar fallback="JD" />
      <Avatar fallback="AB" size="lg" />
    </div>
  );
}
