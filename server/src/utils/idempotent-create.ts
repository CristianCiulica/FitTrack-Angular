/** A lost response may be retried with the same clientId, including concurrently. */
export async function createOnce(model: any, userId: string, body: { clientId?: string }) {
  if (!body.clientId) return model.create({ ...body, userId });
  const filter = { userId, clientId: body.clientId };
  try {
    return await model.findOneAndUpdate(
      filter,
      { $setOnInsert: { ...body, userId } },
      { upsert: true, new: true, runValidators: true },
    );
  } catch (error: any) {
    if (error.code !== 11000) throw error;
    return model.findOne(filter);
  }
}
