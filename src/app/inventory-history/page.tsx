export const dynamic = "force-dynamic";
import prisma from "@/lib/db";

export default async function InventoryHistoryPage() {
  const logs = await prisma.inventoryLog.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      item: true,
    },
  });

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">
        Inventory History
      </h1>

      <table className="w-full border">
        <thead>
          <tr>
            <th>Date</th>
            <th>Item</th>
            <th>Change</th>
            <th>Previous</th>
            <th>Current</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>
                {new Date(log.createdAt).toLocaleString()}
              </td>

              <td>{log.item?.name}</td>

              <td>
                {log.changeQty > 0
                  ? `+${log.changeQty}`
                  : log.changeQty}
              </td>

              <td>{log.previousQty}</td>

              <td>{log.currentQty}</td>

              <td>{log.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
