export class CreatePaymentCommand {
  constructor(
    public readonly reference: string,
    public readonly customerId: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly description?: string,
  ) {}
}
