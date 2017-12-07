export function formatDate(d: Date) : string {
  var dateStr: string = [d.getDate(),
                         d.getMonth()+1,
                         d.getFullYear()].join('-')+'_'+
                        [d.getHours(),
                         d.getMinutes(),
                         d.getSeconds()].join(':');
  return dateStr;
}

export function dateFromExif(exifDate: string) : Date {
  var DateTime: string[] = exifDate.split(" ");
  var dateParts: string[] = DateTime[0].split(":");
  var timeParts: string[] = DateTime[1].split(":");
  return new Date( Number(dateParts[0]),
                   Number(dateParts[1]) - 1,
                   Number(dateParts[2]),
                   Number(timeParts[0]),
                   Number(timeParts[1]),
                   Number(timeParts[2]));
}
