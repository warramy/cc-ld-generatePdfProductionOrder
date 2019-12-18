const fs = require('fs');
const PDFDocument = require('pdfkit')

const companyAddress_y = 30
const companyAddress_height = 35
const company_tel_y = companyAddress_y + companyAddress_height
const taxpayer_y = company_tel_y + 15
const header_width = 180
const header_top_left_x = 395
const production_top_left_x = 20
const production_top_left_y = taxpayer_y + 15
const production_header_height = 92
const lineProductionWidth = 0.5
const wh_text_label_width = 65
const contact_text_height = 10
const title_space = 2
const production_order_top_left_y = taxpayer_y + production_header_height + 18
const column_1_width = 30
const column_2_width = 50
const column_3_width = 200
const column_4_width = 50
const column_5_width = 50
const column_6_width = 50
const column_7_width = 50
let production_order_table_height = 450
const production_order_table_width = 555
const default_font_size = 7
const num_order = 28
const max_num_order = 40


async function generateProductionOrderFilePDF(data, pathFile) {

    return new Promise(function (resolve, reject) {

        let file = fs.createWriteStream(pathFile)
        let doc = new PDFDocument({
            autoFirstPage: false,
            bufferPages: true
        })

        try {
            doc.pipe(file);
            const responseProductionOrderItems = data.bomItems
            let new_responseProductionOrderItems = []
            responseProductionOrderItems.forEach(element => {
                new_responseProductionOrderItems.push(element)

                element.details.forEach(item => {
                    new_responseProductionOrderItems.push(item)
                })

            });

            let i, j, temparray
            const chunk = max_num_order;
            let items_split = []
            for (i = 0, j = new_responseProductionOrderItems.length; i < j; i += chunk) {
                temparray = new_responseProductionOrderItems.slice(i, i + chunk);
                items_split.push(temparray)
            }

            // calculate page
            let pages = 1
            if (new_responseProductionOrderItems.length > num_order) {
                const new_items = new_responseProductionOrderItems.length - num_order
                pages = Math.ceil(new_items / max_num_order) + 1
            }

            // add page
            for (let i = 0; i < pages; i++) {
                doc.addPage({
                    size: [595, 841],
                    margins: {
                        top: 30,
                        bottom: 20,
                        left: 20,
                        right: 30
                    }
                })
            }

            // draw pdf
            doc.font('./resources/fonts/Prompt-Regular.ttf')
            doc.fontSize(default_font_size);
            const range = doc.bufferedPageRange(); // => { start: 0, count: 2 }
            for (i = range.start, end = range.start + range.count, range.start <= end; i < end; i++) {
                doc.switchToPage(i);
                generateHeader(doc, {})
                generateProductionContact(doc, data)
                generateProductionOrderTable(doc, items_split[i] || [])
                if (i === end - 1) {
                    generateResult(doc, data)
                }
            }
            doc.end()
            resolve({
                fileStatus: true,
                file: file
            })
        } catch (err) {
            reject(err)
        }
    });


}


function generateHeader(doc, data) {

    // draw header line
    const header_top_left_y = 30
    const header_height = 50
    const lineWidth = 0.8
    doc.lineWidth(lineWidth)
    doc.lineJoin('round')
        .rect(header_top_left_x,
            header_top_left_y,
            header_width,
            header_height)
        .stroke();


    doc.image('resources/images/default_grCode.png', header_top_left_x - 60, header_top_left_y - 3, {
        fit: [header_height + 5, header_height + 5],
    });

    //draw header
    const header_th = 'ใบสั่งผลิต'
    const header_en = 'Production Order'
    doc.fontSize(9)
    doc.text(`${header_th}`, header_top_left_x, (header_top_left_y + 9), {
        align: 'center',
        width: header_width
    })
    doc.text(`${header_en}`, header_top_left_x, (header_top_left_y + 23), {
        align: 'center',
        width: header_width
    })
}



function generateProductionContact(doc, data) {
    // draw line production contact
    const picking_header_width = 373
    doc.lineWidth(lineProductionWidth)
    doc.lineJoin('round')
        .rect(production_top_left_x,
            production_top_left_y,
            picking_header_width,
            production_header_height)
        .stroke();

    // draw header detail label
    const warehouse_label = 'Warehouse :'
    const warehouse_label_x = production_top_left_x + 7
    const warehouse_label_y = production_top_left_y + 2
    const contact_label_text_options = {
        align: 'left',
        width: wh_text_label_width
    }
    doc.fontSize(default_font_size);
    doc.text(`${warehouse_label}`, warehouse_label_x, warehouse_label_y, contact_label_text_options)

    const warehouse_label_2 = ''
    const warehouse_label_2_y = warehouse_label_y + contact_text_height
    doc.text(`${warehouse_label_2}`, warehouse_label_x, warehouse_label_2_y, contact_label_text_options)

    const create_label = 'ผลิต :'
    const create_label_y = warehouse_label_2_y + contact_text_height + title_space
    doc.text(`${create_label}`, warehouse_label_x, create_label_y, contact_label_text_options)
    const create_label_2 = ''
    const create_label_2_y = create_label_y + contact_text_height
    doc.text(`${create_label_2}`, warehouse_label_x, create_label_2_y, contact_label_text_options)


    const note_label = 'หมายเหตุ :'
    const note_label_y = create_label_2_y + contact_text_height + title_space
    doc.text(`${note_label}`, warehouse_label_x, note_label_y, contact_label_text_options)
    const note_label_2 = ''
    const note_label_2_y = note_label_y + contact_text_height
    doc.text(`${note_label_2}`, warehouse_label_x, note_label_2_y, contact_label_text_options)


    const wh_text_value_width = picking_header_width - 70


    const quantity_label_width = 30
    const quantity_label = 'จำนวน :'
    const quantity_label_x = warehouse_label_x + 175
    doc.text(`${quantity_label}`, quantity_label_x, create_label_y, {
        align: 'left',
        width: quantity_label_width
    })


    const unit_label = 'หน่วย :'
    const unit_label_x = quantity_label_x + 100
    doc.text(`${unit_label}`, unit_label_x, create_label_y, {
        align: 'left',
        width: quantity_label_width
    })


    // draw contact value
    const warehouse_value = `${data.warehouseCode} - ${data.warehouseNameTH || data.warehouseNameEN || ''}`
    const create_value = `${data.productItemCode || ''} - ${data.productItemNameTH || data.productItemNameEN || ''}`
    const quantity_value = data.quantity !== '' ? data.quantity : ''
    const unit_value = data.stockKeepingUnitNameTH || data.stockKeepingUnitNameEN || ''
    const note_value = data.remarks || ''


    const warehouse_value_x = wh_text_label_width + 10
    doc.text(`${warehouse_value}`, warehouse_value_x, warehouse_label_y, {
        align: 'left',
        width: wh_text_value_width
    })

    const create_value_x = wh_text_label_width + 10
    doc.text(`${create_value}`, create_value_x, create_label_y, {
        align: 'left',
        width: 130
    })

    const quantity_value_x = quantity_label_x + quantity_label_width
    doc.text(`${quantity_value}`, quantity_value_x, create_label_y, {
        align: 'left',
        width: 70
    })

    const unit_value_x = unit_label_x + quantity_label_width
    doc.text(`${unit_value}`, unit_value_x, create_label_y, {
        align: 'left',
        width: 70
    })

    const note_value_x = wh_text_label_width + 10
    doc.text(`${note_value}`, note_value_x, note_label_y, {
        align: 'left',
        width: wh_text_value_width
    })

    /*********************************************************/

    // draw line production date
    const request_date_top_left_x = header_top_left_x
    const request_date_top_left_y = taxpayer_y + 15
    const request_date_header_width = header_width
    const request_date_header_height = production_header_height

    doc.lineWidth(lineProductionWidth)

    doc.lineJoin('round')
        .rect(request_date_top_left_x,
            request_date_top_left_y,
            request_date_header_width,
            request_date_header_height)
        .stroke();


    // draw picking date label
    const label_request_date_th = 'วันที่ :'
    const label_request_date_th_x = request_date_top_left_x + 7
    const label_request_date_th_y = request_date_top_left_y + 2
    const contact_text_label_options = {
        align: 'left',
        width: wh_text_label_width
    }
    doc.fontSize(default_font_size);
    doc.text(`${label_request_date_th}`, label_request_date_th_x, label_request_date_th_y, contact_text_label_options)
    const label_request_date_en = 'Request Date'
    const label_request_date_en_y = label_request_date_th_y + contact_text_height
    doc.text(`${label_request_date_en}`, label_request_date_th_x, label_request_date_en_y, contact_text_label_options)

    const label_order_no_th = 'เลขที่ :'
    const label_order_no_th_y = label_request_date_en_y + contact_text_height + title_space
    doc.text(`${label_order_no_th}`, label_request_date_th_x, label_order_no_th_y, contact_text_label_options)
    const label_order_no_en = 'Order No.'
    const label_order_no_en_y = label_order_no_th_y + contact_text_height
    doc.text(`${label_order_no_en}`, label_request_date_th_x, label_order_no_en_y, contact_text_label_options)




    // draw picking date value

    let date = ''
    if (data.transactionDate) {
        const d = new Date(data.transactionDate);
        date = d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear()
    }

    const value_request_date = date
    const value_order_no_th = data.moNumber || ''

    const request_date_value_width = 100
    const value_request_date_x = label_request_date_th_x + 55
    const value_request_date_y = label_request_date_th_y
    const request_date_value_text_options = {
        align: 'left',
        width: request_date_value_width
    }
    doc.text(`${value_request_date}`, value_request_date_x, value_request_date_y, request_date_value_text_options)

    const value_order_no_th_y = label_request_date_en_y + contact_text_height + title_space
    doc.text(`${value_order_no_th}`, value_request_date_x, value_order_no_th_y, request_date_value_text_options)


}



function generateProductionOrderTable(doc, data) {

    production_order_table_height = 450

    doc.lineWidth(lineProductionWidth)
    const table_header_height = 25
    // table header
    doc.lineJoin('round')
        .rect(production_top_left_x,
            production_order_top_left_y,
            production_order_table_width,
            table_header_height)
        .stroke();


    // title column 1
    const column_1_x = production_top_left_x + column_1_width
    const title_column_1_th = 'ลำดับ'
    const title_column_1_en = 'No.'
    const title_column_1_y = production_order_top_left_y + 2
    doc.fontSize(default_font_size);
    doc.text(`${title_column_1_th}`, production_top_left_x, title_column_1_y, {
        align: 'center',
        width: column_1_width
    }).text(`${title_column_1_en}`, {
        align: 'center',
        width: column_1_width
    })


    const column_2_x = column_1_x + column_2_width
    const title_column_2_th = 'รหัสสินค้า'
    const title_column_2_en = 'Item Code'
    doc.text(`${title_column_2_th}`, column_1_x, title_column_1_y, {
        align: 'center',
        width: column_2_width
    }).text(`${title_column_2_en}`, {
        align: 'center',
        width: column_2_width
    })


    const column_3_x = column_2_x + column_3_width
    const title_column_3_th = 'รายละเอียด'
    const title_column_3_en = 'Item Description'
    doc.text(`${title_column_3_th}`, column_2_x, title_column_1_y, {
        align: 'center',
        width: column_3_width
    }).text(`${title_column_3_en}`, {
        align: 'center',
        width: column_3_width
    })


    const column_4_x = column_3_x + column_4_width
    const title_column_4_th = 'หน่วย'
    const title_column_4_en = 'Unit'
    doc.text(`${title_column_4_th}`, column_3_x, title_column_1_y, {
        align: 'center',
        width: column_4_width
    }).text(`${title_column_4_en}`, {
        align: 'center',
        width: column_4_width
    })

    const column_5_x = column_4_x + column_5_width
    const title_column_5_th = 'จำนวน'
    const title_column_5_en = 'Shiping'
    doc.text(`${title_column_5_th}`, column_4_x, title_column_1_y, {
        align: 'center',
        width: column_5_width
    }).text(`${title_column_5_en}`, {
        align: 'center',
        width: column_5_width
    })

    const column_6_x = column_5_x + column_6_width
    const title_column_6_th = 'วันหมดอายุ'
    const title_column_6_en = 'ExpiredDate'
    doc.text(`${title_column_6_th}`, column_5_x, title_column_1_y, {
        align: 'center',
        width: column_6_width
    }).text(`${title_column_6_en}`, {
        align: 'center',
        width: column_6_width
    })


    let order_y = production_order_top_left_y + table_header_height + 3

    for (let i = 0; i < data.length; i++) {

        let seq = data[i].seq || ''
        let productItemCode = ''
        let itemDescription = ''
        let productionUnit = ''
        let productionQuantity = ''
        let expireDate = ''

        if (seq !== '') {
            productItemCode = data[i].productItemCode || productItemCode
            itemDescription = data[i].productItemNameTH || data[i].productItemNameEN || itemDescription
            productionUnit = data[i].stockKeepingUnitNameTH || data[i].stockKeepingUnitNameEN || productionUnit
            productionQuantity = data[i].quantity >= 0 ? data[i].quantity : productionQuantity
        } else {
            productionQuantity = data[i].quantity >= 0 ? data[i].quantity : productionQuantity
            if (data[i].expiredDate != '') {
                const dateTimeStamp = Date.parse(data[i].expiredDate);
                const d = new Date(dateTimeStamp);
                expireDate = d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear()
            }

        }

        doc.text(`${seq}`, production_top_left_x, order_y, {
            align: 'center',
            width: column_1_width
        })
        doc.text(`${productItemCode}`, column_1_x, order_y, {
            align: 'center',
            width: column_2_width
        })
        doc.text(`${itemDescription}`, column_2_x + 5, order_y, {
            align: 'left',
            width: column_3_width - 10
        })
        doc.text(`${productionUnit}`, column_3_x + 5, order_y, {
            align: 'center',
            width: column_4_width - 10
        })
        if (seq !== '') {
            doc.font('./resources/fonts/Prompt-Bold.ttf')
        }
        doc.text(`${productionQuantity}`, column_4_x + 5, order_y, {
            align: 'center',
            width: column_5_width - 10
        })
        doc.font('./resources/fonts/Prompt-Regular.ttf')
        doc.text(`${expireDate}`, column_5_x + 5, order_y, {
            align: 'center',
            width: column_6_width - 10
        })

        order_y += 15
        if (i > num_order - 1) {
            production_order_table_height += 15
        }
    }
    //  draw table
    doc.lineJoin('round')
        .rect(production_top_left_x,
            production_order_top_left_y,
            production_order_table_width,
            production_order_table_height)
        .stroke();


    // column 1
    const column_height = production_order_top_left_y + production_order_table_height
    doc.moveTo(column_1_x, production_order_top_left_y)
        .lineTo(column_1_x, column_height)
        .stroke()
    // column 2
    doc.moveTo(column_2_x, production_order_top_left_y)
        .lineTo(column_2_x, column_height)
        .stroke()
    // column 3
    doc.moveTo(column_3_x, production_order_top_left_y)
        .lineTo(column_3_x, column_height)
        .stroke()
    // column 4
    doc.moveTo(column_4_x, production_order_top_left_y)
        .lineTo(column_4_x, column_height)
        .stroke()
    // column 5
    doc.moveTo(column_5_x, production_order_top_left_y)
        .lineTo(column_5_x, column_height)
        .stroke()
    // column 6
    doc.moveTo(column_6_x, production_order_top_left_y)
        .lineTo(column_6_x, column_height)
        .stroke()



}

function generateResult(doc, data) {

    const production_order_table_amount_y = production_order_top_left_y + production_order_table_height
    const production_order_table_amount_height = 80
    doc.lineJoin('round')
        .rect(production_top_left_x,
            production_order_table_amount_y,
            production_order_table_width,
            production_order_table_amount_height)
        .stroke();
    doc.lineWidth(lineProductionWidth)
    const note = 'หมายเหตุ : '
    doc.text(`${note}`, production_top_left_x + 5, production_order_table_amount_y + 5, {
        align: 'left',
        width: production_order_table_width - column_5_width - column_6_width - column_7_width - 10
    })

    const signature_array = [
        {
            title: 'ผู้สั่งผลิต / Issued By'
        },
        {
            title: 'ผู้ตรวจสอบ / Checked By'
        },
        {
            title: 'ผู้ผลิต / Produced By'
        },
        {
            title: 'ผู้บันทึกรับสินค้า / Recorded By'
        }
    ]
    const signature_y = production_order_table_amount_y + production_order_table_amount_height + 5
    const signature_width = 138
    const signature_height = 90
    const signature_space = 0.75
    const sigature_fill = '..................................................................................................'
    const sigature_fill_date = 'วันที่ / Date......................................................................'
    let signature_x = production_top_left_x

    signature_array.forEach(item => {

        doc.lineJoin('round')
            .rect(signature_x,
                signature_y,
                signature_width,
                signature_height)
            .stroke();
        const signature_label = item.title || ''
        const signature_label_x = signature_x + 5
        const signature_label_y = signature_y + 5
        const signature_label_text_options = {
            align: 'left',
            width: signature_width - 10
        }
        const sigature_fill_y = signature_y + signature_height - 30
        const sigature_fill_date_y = signature_y + signature_height - 15
        doc.text(`${signature_label}`, signature_label_x, signature_label_y, signature_label_text_options)
        doc.text(`${sigature_fill}`, signature_label_x, sigature_fill_y, signature_label_text_options)
        doc.text(`${sigature_fill_date}`, signature_label_x, sigature_fill_date_y, signature_label_text_options)

        signature_x += (signature_width + signature_space)
    })

}

module.exports = {
    generateProductionOrderFilePDF
}