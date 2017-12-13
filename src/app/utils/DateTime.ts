
export function formatDate(d: Date) : string {
  var dateStr: string = [d.getDate(),
                         d.getMonth()+1,
                         d.getFullYear()].join('/')+'_'+
                        [d.getHours(),
                         d.getMinutes(),
                         d.getSeconds()].join(':');
  return dateStr;
}

export function formatDateSafe(d: Date) : string {
  var dateStr: string = [d.getFullYear(),
                         d.getMonth()+1,
                         d.getDate()].join('-')+'_'+
                        [d.getHours(),
                         d.getMinutes(),
                         d.getSeconds()].join('-');
  return dateStr;
}

export function datefromSafeFormat(str: string) : Date {
  return dateFromStr(str, "_", "-");
}

export function dateFromExif(exifDate: string) : Date {
  return dateFromStr(exifDate, " ", ":");
}

function dateFromStr(str: string, majorSeparator: string, minorSeparator: string) {
  var DateTime: string[] = str.split(majorSeparator);
  var dateParts: string[] = DateTime[0].split(minorSeparator);
  var timeParts: string[] = DateTime[1].split(minorSeparator);
  return new Date( Number(dateParts[0]),
                   Number(dateParts[1]) - 1,
                   Number(dateParts[2]),
                   Number(timeParts[0]),
                   Number(timeParts[1]),
                   Number(timeParts[2]));
}
