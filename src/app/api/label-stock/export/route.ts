import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrDataLead } from '@/lib/requireSession';
import clientPromise from '@/lib/mongodb';
import {
  computeBurnForecast,
  enrichStockRow,
  normalizeSchoolKey,
  type LabelStockDoc,
} from '@/lib/labelStock';

function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminOrDataLead();
    if (!auth.ok) return auth.response;
    const role = auth.user.role;
    const userSchool = normalizeSchoolKey(auth.user.school);
    if (role === 'Data Lead' && !userSchool) {
      return NextResponse.json({ error: 'No school assigned' }, { status: 403 });
    }

    const schoolParam = normalizeSchoolKey(req.nextUrl.searchParams.get('school'));
    const query: Record<string, unknown> = {};
    if (role === 'Data Lead') {
      query.$or = [
        { school: userSchool },
        { school: { $exists: false } },
        { school: null },
        { school: '' },
      ];
    } else if (schoolParam) {
      query.school = schoolParam;
    }

    const client = await clientPromise;
    const db = client.db('student-label');
    const stock = (await db
      .collection('label_stock')
      .find(query)
      .sort({ school: 1, template: 1 })
      .toArray()) as LabelStockDoc[];

    const rows = await Promise.all(
      stock.map(async (item) => {
        const forecast = await computeBurnForecast(db, item._id, 30);
        return enrichStockRow(item, forecast);
      }),
    );

    const headers = [
      'School',
      'Template',
      'Unit',
      'Current Stock',
      'Pack Size',
      'Low Stock Threshold',
      'Status',
      'Cost Per Unit',
      'Total Value',
      'Supplier',
      'SKU',
      'Supplier URL',
      'Reorder Qty',
      'Last Ordered',
      'Days Left (30d burn)',
      'Avg Units/Day',
      'Notes',
    ];

    const lines = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.school || 'Global',
          r.templateName || r.template,
          r.unitLabel,
          r.currentStock,
          r.packSize,
          r.lowStockThreshold,
          r.isLowStock ? 'Low Stock' : 'In Stock',
          (Number(r.costPerSheet) || 0).toFixed(2),
          (Number(r.totalValue) || 0).toFixed(2),
          r.supplier || '',
          r.sku || '',
          r.supplierUrl || '',
          r.reorderQty ?? '',
          r.lastOrderedAt || '',
          r.daysLeft == null ? (r.currentStock > 0 ? 'n/a' : '0') : r.daysLeft,
          (Number(r.avgPerDay) || 0).toFixed(2),
          r.notes || '',
        ]
          .map(csvEscape)
          .join(','),
      ),
    ];

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="label-stock-${date}.csv"`,
      },
    });
  } catch (error) {
    console.error('[label-stock/export]', error);
    return NextResponse.json({ error: 'Failed to export stock' }, { status: 500 });
  }
}
