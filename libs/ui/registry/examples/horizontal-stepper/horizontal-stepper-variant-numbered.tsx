import { HorizontalStepper } from "@/components/ui/horizontal-stepper"

export default function HorizontalStepperVariantNumbered() {
  return (
    <HorizontalStepper
      steps={["cart", "shipping", "payment", "review", "confirm"]}
      value="payment"
      variant="numbered"
      aria-label="Checkout progress"
    >
      <HorizontalStepper.Step value="cart">Cart</HorizontalStepper.Step>
      <HorizontalStepper.Step value="shipping">Shipping</HorizontalStepper.Step>
      <HorizontalStepper.Step value="payment">Payment</HorizontalStepper.Step>
      <HorizontalStepper.Step value="review">Review</HorizontalStepper.Step>
      <HorizontalStepper.Step value="confirm">Confirm</HorizontalStepper.Step>
    </HorizontalStepper>
  )
}
