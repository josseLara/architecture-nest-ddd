export class RejectPaymentCommand {
  constructor(
    public readonly paymentId: string,
    public readonly reason: string,
  ) {}
}
