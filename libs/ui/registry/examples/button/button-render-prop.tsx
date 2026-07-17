import { Button } from "@/components/ui/button";

export default function ButtonRenderProp() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button<HTMLAnchorElement> variant="link">
        {({ ref, disabled: _disabled, onClick, ...props }) => (
          <a ref={ref} href="/docs" onClick={onClick} {...props}>
            Render-prop link
          </a>
        )}
      </Button>
      <Button<HTMLAnchorElement> variant="secondary" disabled>
        {({ ref, disabled: _disabled, onClick, ...props }) => (
          <a ref={ref} href="/docs" onClick={onClick} {...props}>
            Disabled link
          </a>
        )}
      </Button>
      <Button<HTMLAnchorElement> variant="ghost" loading>
        {({ ref, disabled: _disabled, onClick, ...props }) => (
          <a ref={ref} href="/docs" onClick={onClick} {...props}>
            Loading link
          </a>
        )}
      </Button>
    </div>
  );
}
