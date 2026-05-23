import { num } from "./appFormatters";

export function getPaidTotal(job) {
  return (job.paymentEvents || []).reduce((sum, payment) => {
    if (payment.type === "Refund") return sum - num(payment.amount);
    return sum + num(payment.amount);
  }, 0);
}

export function getKnownJobCost(job) {
  const actuals = job.actuals || {};
  const materialUsageCost = (job.materialUsageEvents || []).reduce(
    (sum, usage) => sum + num(usage.estimatedCost),
    0
  );

  return (
    Math.max(num(actuals.materialCost), materialUsageCost) +
    num(actuals.failedPrintCost) +
    num(actuals.extraCost)
  );
}

export function getJobProfit(job) {
  return num(job.finalTotal) - getKnownJobCost(job);
}

export function getJobMargin(job) {
  const total = num(job.finalTotal);
  return total > 0 ? (getJobProfit(job) / total) * 100 : 0;
}

export function getInventoryValue(item) {
  return num(item.quantityOnHand) * num(item.unitCost);
}

export function getPaymentStatus(job) {
  const total = num(job.finalTotal);
  const paid = getPaidTotal(job);
  if (paid <= 0) return "Unpaid";
  if (paid >= total) return paid > total ? "Overpaid" : "Paid";
  return "Partially Paid";
}
