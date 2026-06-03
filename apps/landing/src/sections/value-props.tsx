import { Card } from "@diffgazer/ui/components/card";
import { VALUE_PROPS } from "../content";

export function ValueProps() {
  return (
    <section aria-labelledby="value-props-heading">
      <h2
        id="value-props-heading"
        className="text-center font-mono text-sm uppercase tracking-widest text-muted-foreground"
      >
        What you get
      </h2>
      <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {VALUE_PROPS.map((prop) => (
          <li key={prop.title}>
            <Card as="article" surface="glow" className="h-full">
              <Card.Header>
                <Card.Title className="font-mono text-base text-foreground">
                  {prop.title}
                </Card.Title>
              </Card.Header>
              <Card.Content className="font-sans text-sm text-muted-foreground">
                {prop.body}
              </Card.Content>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
