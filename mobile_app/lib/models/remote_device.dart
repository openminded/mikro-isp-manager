class RemoteDevice {
  final String id;
  final String comment;
  final String dstPort;
  final String toAddress;
  final String toPorts;
  final String protocol;
  final String serverId;
  final String? lastCheckStatus;

  RemoteDevice({
    required this.id,
    required this.comment,
    required this.dstPort,
    required this.toAddress,
    required this.toPorts,
    required this.protocol,
    required this.serverId,
    this.lastCheckStatus,
  });

  factory RemoteDevice.fromJson(Map<String, dynamic> json) {
    return RemoteDevice(
      id: json['id'].toString(),
      comment: json['comment'] ?? '',
      dstPort: json['dst_port']?.toString() ?? '',
      toAddress: json['to_address'] ?? '',
      toPorts: json['to_ports']?.toString() ?? '',
      protocol: json['protocol'] ?? 'tcp',
      serverId: json['server_id']?.toString() ?? '',
      lastCheckStatus: json['last_check_status'],
    );
  }
}
