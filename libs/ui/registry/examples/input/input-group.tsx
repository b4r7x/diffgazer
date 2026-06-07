import { InputGroup } from "@/components/ui/input";

export default function InputGroupExample() {
  return (
    <InputGroup
      aria-label="Config path"
      prefix="~/"
      suffix=".json"
      placeholder="diffgazer/config"
    />
  );
}
