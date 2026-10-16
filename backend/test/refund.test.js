import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentService } from '../src/services/payment.service.js';
import { paymentRepository } from '../src/repositories/payment.repository.js';

test('seed payments cannot initiate a real Stripe refund', async () => {
  const original = paymentRepository.findById;
  paymentRepository.findById = async () => ({ status: 'PAID', order_status: 'PAID',
    provider_payment_id: 'pi_demo_nocturno_1' });
  try {
    await assert.rejects(paymentService.requestFullRefund('fixture-id'),
      (error) => error.status === 409 && error.code === 'DEMO_PAYMENT_NOT_REFUNDABLE');
  } finally { paymentRepository.findById = original; }
});
